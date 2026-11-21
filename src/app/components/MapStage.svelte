<script lang="ts">
  /**
   * Central map stage: the preview frame (exact video framing), OpenLayers background, scene overlay
   * canvas, drag-and-drop of GPX files and the playback loop.
   * Playing → view comes from timeline.frameStateAt(t) (what the export renders).
   * Paused → free pan/zoom, north-up (STORY-5/7).
   */
  import OlMap from 'ol/Map';
  import View from 'ol/View';
  import { defaults as defaultInteractions } from 'ol/interaction/defaults';
  import { boundingExtent } from 'ol/extent';
  import { onMount, untrack } from 'svelte';
  import { app } from '../state.svelte';
  import { defaultBackground } from '../../lib/map/layers';
  import { drawScene, projectedTrack } from '../../lib/render/scene';
  import type { ViewState } from '../../lib/anim/timeline';

  let stageEl: HTMLDivElement;
  let mapEl: HTMLDivElement;
  let overlayEl: HTMLCanvasElement;
  let map: OlMap | undefined;
  let attribution = '';
  let dragging = $state(false);
  let stage = $state({ width: 0, height: 0 });
  let wasPlaying = false;

  // Fit the frame of the chosen aspect ratio into the stage.
  $effect(() => {
    const pad = 28;
    const sw = Math.max(0, stage.width - pad * 2);
    const sh = Math.max(0, stage.height - pad * 2);
    const w = Math.max(160, Math.floor(Math.min(sw, sh * app.aspect)));
    const h = Math.max(90, Math.floor(w / app.aspect));
    app.frame = { width: w, height: h };
  });

  $effect(() => {
    const { width, height } = app.frame;
    if (!map || !overlayEl || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    overlayEl.width = Math.round(width * dpr);
    overlayEl.height = Math.round(height * dpr);
    map.updateSize();
    map.render();
  });

  // (Re)build view and background when the view CRS changes.
  $effect(() => {
    const crs = app.crs;
    if (!map) return;
    const bg = defaultBackground(crs.code);
    attribution = bg.map((b) => b.attribution).join(' · ');
    map.getLayers().clear();
    bg.forEach((b) => map!.addLayer(b.layer));
    map.setView(
      new View({
        projection: crs.code,
        center: crs.code === 'EPSG:3067' ? [430000, 7200000] : [2700000, 8500000],
        resolution: crs.code === 'EPSG:3067' ? 1600 : 2500,
        constrainResolution: false,
        smoothResolutionConstraint: false,
      }),
    );
    if (app.track) fitTrack();
  });

  // New track → fit it.
  $effect(() => {
    if (app.track && map) fitTrack();
  });

  // Paused: north-up again, follow seeks (STORY-4/5). Only reacts to time/playing changes, so a
  // freshly loaded track keeps its fitted view.
  let lastTime = 0;
  $effect(() => {
    const t = app.time;
    const playing = app.playing;
    untrack(() => {
      const tl = app.timeline;
      if (!map || !tl || playing) return;
      const view = map.getView();
      if (wasPlaying) {
        wasPlaying = false;
        view.animate({ rotation: 0, duration: 250 });
      } else if (t !== lastTime) {
        view.setCenter(tl.frameStateAt(t, app.frame.height).positionXY);
      }
      lastTime = t;
      map.render();
    });
  });

  // Scale changed while paused → show that scale at the current position (STORY-6).
  let lastScale = app.free.scale;
  $effect(() => {
    const s = app.free.scale;
    untrack(() => {
      const tl = app.timeline;
      if (map && tl && !app.playing && s !== lastScale) {
        map.getView().setResolution(tl.resolution);
        map.getView().setCenter(tl.frameStateAt(app.time, app.frame.height).positionXY);
      }
      lastScale = s;
    });
  });

  // Redraw the overlay when anything drawn on it changes.
  $effect(() => {
    void [app.style.showInfo, app.style.showNorthArrow, app.style.showScaleBar, app.free.headingUp, app.speed];
    map?.render();
  });

  // Interactions only while paused and not exporting.
  $effect(() => {
    const active = !app.playing && !app.exporting;
    map?.getInteractions().forEach((i) => i.setActive(active));
  });

  function fitTrack() {
    if (!map || !app.track) return;
    const xy = projectedTrack(app.track, app.crs.code);
    const coords: [number, number][] = [];
    for (let i = 0; i < xy.length; i += 2) coords.push([xy[i], xy[i + 1]]);
    map.getView().setRotation(0);
    map.getView().fit(boundingExtent(coords), { padding: [40, 40, 60, 40] });
  }

  function drawOverlay() {
    if (!map || !overlayEl) return;
    const ctx = overlayEl.getContext('2d')!;
    ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
    const view = map.getView();
    const center = view.getCenter();
    const resolution = view.getResolution();
    if (!center || !resolution) return;
    const vs: ViewState = { center: center as [number, number], resolution, rotation: view.getRotation() };
    const tl = app.timeline;
    const heading = tl ? tl.frameStateAt(app.time, app.frame.height).gridHeading : null;
    drawScene(ctx, overlayEl.width, overlayEl.height, overlayEl.width / app.frame.width, vs, {
      crsCode: app.crs.code,
      track: app.track,
      time: app.track ? app.time : null,
      heading,
      speed: app.speed,
      attribution,
      style: app.style,
    });
  }

  function applyFrame() {
    const tl = app.timeline;
    if (!map || !tl) return;
    const fs = tl.frameStateAt(app.time, app.frame.height);
    const view = map.getView();
    view.cancelAnimations();
    view.setCenter(fs.view.center);
    view.setResolution(fs.view.resolution);
    view.setRotation(fs.view.rotation);
    map.renderSync();
  }

  onMount(() => {
    map = new OlMap({
      target: mapEl,
      controls: [],
      interactions: defaultInteractions({ altShiftDragRotate: true, pinchRotate: true }),
      layers: [],
    });
    map.on('postrender', drawOverlay);
    // Trigger the CRS effect now that the map exists.
    app.crs = { ...app.crs };

    const ro = new ResizeObserver(([e]) => {
      stage = { width: e.contentRect.width, height: e.contentRect.height };
    });
    ro.observe(stageEl);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (app.playing && app.track) {
        wasPlaying = true;
        app.time = Math.min(app.track.duration, app.time + dt * app.speed);
        if (app.time >= app.track.duration) app.playing = false;
        applyFrame();
      }
    };
    raf = requestAnimationFrame(tick);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__omv = { app, map: () => map };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map?.setTarget(undefined);
    };
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    if (app.exporting) return;
    const file = e.dataTransfer?.files[0];
    if (file) app.loadFile(file);
  }
</script>

<div
  class="stage"
  bind:this={stageEl}
  role="region"
  aria-label="Map preview"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <div
    class="frame"
    class:locked={app.exporting}
    class:dragging
    style:width="{app.frame.width}px"
    style:height="{app.frame.height}px"
    data-testid="map-frame"
  >
    <div class="map" bind:this={mapEl}></div>
    <canvas class="overlay" bind:this={overlayEl} data-testid="overlay"></canvas>

    {#if !app.track}
      <div class="empty">
        <div class="card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M4 18c3-6 6 2 9-4s4-7 7-6" stroke-linecap="round" /><circle cx="4" cy="18" r="1.6" /><path
              d="m18 4 2 2-2 2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <h2>Drop a GPX file here</h2>
          <p>Your file is processed on this device and never uploaded.</p>
          <div class="row">
            <label class="btn primary">
              Choose GPX…
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                hidden
                data-testid="gpx-input"
                onchange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) app.loadFile(f);
                }}
              />
            </label>
            <button class="btn" onclick={() => app.loadSample()} data-testid="load-sample">Load sample</button>
          </div>
          {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
        </div>
      </div>
    {/if}
    {#if dragging}<div class="dropzone">Drop GPX to load</div>{/if}
  </div>
  <div class="frame-caption mono">
    {app.frame.width} × {app.frame.height} px · {app.crs.name}
    {#if app.exporting}<span class="lock">● Exporting – frame locked</span>{/if}
  </div>
</div>

<style>
  .stage {
    position: relative;
    min-height: 0;
    min-width: 0;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0) 0 0 / 22px 22px,
      var(--bg);
    overflow: hidden;
  }
  .frame {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--border-strong),
      var(--shadow);
    background: #ece8df;
  }
  .frame.locked {
    box-shadow:
      0 0 0 2px var(--danger),
      var(--shadow);
  }
  .frame.dragging {
    box-shadow:
      0 0 0 2px var(--accent),
      var(--shadow);
  }
  .map,
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .overlay {
    pointer-events: none;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(13, 16, 20, 0.55);
    backdrop-filter: blur(2px);
  }
  .card {
    text-align: center;
    padding: 28px 32px;
    border-radius: 14px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    max-width: 380px;
    color: var(--text);
  }
  .card svg {
    color: var(--accent);
  }
  .card h2 {
    margin: 8px 0 4px;
    font-size: 18px;
  }
  .card p {
    margin: 0 0 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .card .row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .card .error {
    margin: 14px 0 0;
    color: var(--danger);
  }
  .dropzone {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    border: 2px dashed var(--accent);
    color: var(--text);
    font-weight: 600;
    font-size: 16px;
  }
  .frame-caption {
    position: absolute;
    bottom: 6px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 11px;
    color: var(--text-faint);
  }
  .lock {
    color: var(--danger);
    margin-left: 8px;
  }
</style>
