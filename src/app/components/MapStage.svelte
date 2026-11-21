<script lang="ts">
  /**
   * Central map stage: the preview frame (exact video framing, freely resizable), the OpenLayers layer
   * stack from `app.layers`, the scene overlay canvas, drag-and-drop of GPX/map files, map clicks for
   * georeferencing, and the playback loop.
   * Playing → view comes from timeline.frameStateAt(t) (what the export renders).
   * Paused → free pan/zoom, north-up (STORY-5/7).
   */
  import OlMap from 'ol/Map';
  import View from 'ol/View';
  import type BaseLayer from 'ol/layer/Base';
  import { defaults as defaultInteractions } from 'ol/interaction/defaults';
  import { boundingExtent } from 'ol/extent';
  import { onMount, untrack } from 'svelte';
  import { app, MIN_FRAME } from '../state.svelte';
  import { createOlLayer, type LayerDesc } from '../../lib/map/layerModel';
  import { registerProjections } from '../../lib/map/layers';
  import { drawScene, makeTransform, projectedTrack, type SceneInput } from '../../lib/render/scene';
  import { sceneForFrame } from '../../lib/render/frameScene';
  import { formatRouteLength, routeLength, routesForLeg } from '../../lib/course/routes';
  import { forward, inverse, pointScale } from '../../lib/geo/crs';
  import { apply, type Pt } from '../../lib/raster/affine';
  import { rasterExtent, viewAffine, viewToPixel, type RasterMap } from '../../lib/raster/rasterMap';
  import type { ViewState } from '../../lib/anim/timeline';
  import type { GpxData } from '../../lib/gpx/gpx';
  import { drawEditorMarks, installTools, syncInteractions } from '../mapTools';

  let stageEl: HTMLDivElement;
  let mapEl: HTMLDivElement;
  let overlayEl: HTMLCanvasElement;
  let map: OlMap | undefined;
  let mapReady = $state(false);
  let dragging = $state(false);
  let stage = $state({ width: 0, height: 0 });
  let wasPlaying = false;
  const PAD = 28;

  // ---------------- Frame size ----------------
  $effect(() => {
    const sw = Math.max(MIN_FRAME.width, stage.width - PAD * 2);
    const sh = Math.max(MIN_FRAME.height, stage.height - PAD * 2);
    const custom = app.frameCustom;
    let w: number;
    let h: number;
    if (custom) {
      // Free size, scaled down (keeping its shape) if the stage got smaller.
      const k = Math.min(1, sw / custom.width, sh / custom.height);
      w = Math.floor(custom.width * k);
      h = Math.floor(custom.height * k);
    } else {
      w = Math.floor(Math.min(sw, sh * app.aspect));
      h = Math.floor(w / app.aspect);
    }
    app.frame = { width: Math.max(MIN_FRAME.width, w), height: Math.max(MIN_FRAME.height, h) };
  });

  $effect(() => {
    const { width, height } = app.frame;
    if (!mapReady || !overlayEl || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    overlayEl.width = Math.round(width * dpr);
    overlayEl.height = Math.round(height * dpr);
    map!.updateSize();
    map!.render();
  });

  let resizeStart: { x: number; y: number; w: number; h: number } | null = null;
  function onResizeDown(e: PointerEvent) {
    if (app.locked) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeStart = { x: e.clientX, y: e.clientY, w: app.frame.width, h: app.frame.height };
  }
  function onResizeMove(e: PointerEvent) {
    if (!resizeStart) return;
    const maxW = stage.width - PAD * 2;
    const maxH = stage.height - PAD * 2;
    // The frame is centred, so the corner moves half of the size change.
    let w = Math.min(maxW, Math.max(MIN_FRAME.width, resizeStart.w + 2 * (e.clientX - resizeStart.x)));
    let h = Math.min(maxH, Math.max(MIN_FRAME.height, resizeStart.h + 2 * (e.clientY - resizeStart.y)));
    if (e.shiftKey) {
      // Shift keeps the current aspect ratio.
      const a = resizeStart.w / resizeStart.h;
      h = Math.min(maxH, w / a);
      w = h * a;
    }
    app.setFrameSize(w, h);
  }
  function onResizeUp() {
    resizeStart = null;
  }

  // ---------------- Layers and view CRS ----------------
  let currentCrs = '';
  let lastRaster: RasterMap | null = null;
  /** Fit only when a new GPX is loaded – not when edits rebuild the track. */
  let lastGpx: GpxData | null = null;
  let fittedRasterLevels: ImageBitmap[] | null = null;
  const olLayers = new Map<string, BaseLayer>();

  $effect(() => {
    const crs = app.crs.code;
    const raster = app.raster;
    const descs = $state.snapshot(app.layers) as LayerDesc[];
    if (!mapReady) return;
    untrack(() => syncLayers(crs, raster, descs));
  });

  function switchView(crs: string) {
    registerProjections(); // also picks up UTM zones defined since the last call
    const old = map!.getView();
    const oc = old.getCenter();
    const or = old.getResolution();
    let center: number[] = crs === 'EPSG:3067' ? [430000, 7200000] : [2700000, 8500000];
    let resolution = crs === 'EPSG:3067' ? 1600 : 2500;
    if (currentCrs && oc && or) {
      const ll = inverse(currentCrs, oc as Pt);
      center = forward(crs, ll);
      resolution = (or * pointScale(crs, ll)) / pointScale(currentCrs, ll);
    }
    map!.setView(
      new View({ projection: crs, center, resolution, constrainResolution: false, smoothResolutionConstraint: false }),
    );
    map!.getView().on('change:center', () => {
      const c = map!.getView().getCenter();
      if (c) app.viewCenter = c as Pt;
    });
  }

  /** Counts tile loads/errors so the layer list can flag services whose tiles never load (CORS etc.). */
  function watchTiles(id: string, layer: BaseLayer) {
    const source = (
      layer as unknown as { getSource?: () => { on?: (t: string, f: () => void) => void } }
    ).getSource?.();
    if (!source?.on) return;
    const bump = (key: 'ok' | 'error') => {
      const h = app.layerHealth[id] ?? { ok: 0, error: 0 };
      app.layerHealth[id] = { ...h, [key]: h[key] + 1 };
    };
    source.on('tileloadend', () => bump('ok'));
    source.on('tileloaderror', () => bump('error'));
  }

  function syncLayers(crs: string, raster: RasterMap | null, descs: LayerDesc[]) {
    if (crs !== currentCrs) {
      switchView(crs);
      currentCrs = crs;
      olLayers.clear();
    }
    if (raster !== lastRaster) olLayers.delete('raster');
    lastRaster = raster;
    const ids = new Set(descs.map((d) => d.id));
    for (const id of [...olLayers.keys()]) if (!ids.has(id)) olLayers.delete(id);
    const stack: BaseLayer[] = [];
    for (const d of descs) {
      let l = olLayers.get(d.id);
      if (!l) {
        l = createOlLayer(d, crs, raster) ?? undefined;
        if (l) {
          olLayers.set(d.id, l);
          watchTiles(d.id, l);
        }
      }
      if (!l) continue;
      l.setVisible(d.visible);
      l.setOpacity(d.opacity);
      stack.push(l);
    }
    const coll = map!.getLayers();
    coll.clear();
    coll.extend(stack);
    // Fit newly added data: a new raster (not a georeference update) or a new track.
    if (raster && raster.levels !== fittedRasterLevels) {
      fittedRasterLevels = raster.levels;
      map!.getView().setRotation(0);
      map!.getView().fit(rasterExtent(raster, crs), { padding: [30, 30, 30, 30] });
    } else if (app.track && app.gpx !== lastGpx) {
      fitTrack();
    }
    lastGpx = app.gpx;
    map!.render();
  }

  // New GPX (CRS unchanged) → fit it.
  $effect(() => {
    const g = app.gpx;
    if (!mapReady || !g) return;
    untrack(() => {
      if (g !== lastGpx && app.crs.code === currentCrs) {
        lastGpx = g;
        fitTrack();
      }
    });
  });

  // ---------------- Playback / paused behaviour ----------------
  // Paused: north-up again, follow seeks (STORY-4/5). Only reacts to time/playing changes.
  let lastTime = 0;
  $effect(() => {
    const t = app.time;
    const playing = app.playing;
    untrack(() => {
      const tl = app.timeline;
      if (!map || !tl || playing) return;
      const view = map.getView();
      if (app.followFrame && app.tool === 'none') {
        // "Video view": the paused preview shows exactly the exported frame at the playhead.
        wasPlaying = false;
        applyFrame();
      } else if (wasPlaying) {
        wasPlaying = false;
        view.animate({ rotation: 0, duration: 250 });
      } else if (t !== lastTime) {
        view.setCenter(tl.frameStateAt(t, app.frame).positionXY);
      }
      lastTime = t;
      map.render();
    });
  });

  // Paused "video view": re-apply the frame when camera settings or the frame change. (Not when new data is
  // loaded – that keeps the fitted overview until the user seeks or plays.)
  $effect(() => {
    void [
      $state.snapshot(app.courseCamera),
      $state.snapshot(app.free),
      $state.snapshot(app.routeDisplay),
      app.courseModeEnabled,
      app.speed,
      app.frame.width,
      app.frame.height,
      app.followFrame,
    ];
    untrack(() => {
      if (mapReady && !app.playing && app.followFrame && app.tool === 'none' && app.timeline) applyFrame();
    });
  });

  // Editing tools work north-up (centre and zoom kept).
  let lastTool = app.tool;
  $effect(() => {
    const t = app.tool;
    untrack(() => {
      if (mapReady && t !== 'none' && lastTool === 'none') {
        map!.getView().cancelAnimations();
        map!.getView().setRotation(0);
      } else if (mapReady && t === 'none' && lastTool !== 'none' && app.followFrame && app.timeline) {
        applyFrame();
      }
      lastTool = t;
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
        map.getView().setCenter(tl.frameStateAt(app.time, app.frame).positionXY);
      }
      lastScale = s;
    });
  });

  // Redraw the overlay when anything drawn on it changes.
  $effect(() => {
    void [
      app.style.showNorthArrow,
      app.free.headingUp,
      app.georef.active,
      app.georef.pendingPixel,
      app.georef.pairs.length,
      app.course,
      app.courseStyle.visible,
      app.courseStyle.sizeMode,
      app.courseStyle.sizeFactor,
      app.courseStyle.showNumbers,
      app.selectedPointId,
      app.passings,
      app.tool,
      app.selectedTrackIndex,
      app.brushRadius,
      app.editRange[0],
      app.editRange[1],
      app.redrawPath,
      app.showOriginalGpx,
      app.routes,
      app.routeLeg,
      app.routeDraft,
      app.timeline,
    ];
    map?.render();
  });

  // Interactions only while paused and not exporting.
  $effect(() => {
    void [app.playing, app.exporting, app.tool];
    if (mapReady) syncInteractions(map!);
  });

  function fitTrack() {
    if (!map || !app.track) return;
    const xy = projectedTrack(app.track, app.crs.code);
    const coords: [number, number][] = [];
    for (let i = 0; i < xy.length; i += 2) coords.push([xy[i], xy[i + 1]]);
    map.getView().setRotation(0);
    map.getView().fit(boundingExtent(coords), { padding: [40, 40, 60, 40] });
  }

  function currentViewState(): ViewState | null {
    const view = map!.getView();
    const center = view.getCenter();
    const resolution = view.getResolution();
    if (!center || !resolution) return null;
    return { center: center as [number, number], resolution, rotation: view.getRotation() };
  }

  function drawOverlay() {
    if (!map || !overlayEl) return;
    const ctx = overlayEl.getContext('2d')!;
    ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
    const vs = currentViewState();
    if (!vs) return;
    const pr = overlayEl.width / app.frame.width;
    drawScene(ctx, overlayEl.width, overlayEl.height, pr, vs, previewScene());
    drawEditorMarks(ctx, map, pr);
    if (app.georef.active && app.raster) drawGeorefMarks(ctx, vs, pr);
  }

  /** Point pairs while georeferencing (preview only, never exported). */
  function drawGeorefMarks(ctx: CanvasRenderingContext2D, vs: ViewState, pr: number) {
    const raster = app.raster!;
    const crs = app.crs.code;
    const T = makeTransform(vs, overlayEl.width, overlayEl.height, pr);
    const A = viewAffine(raster, crs);
    const dot = (p: Pt, fill: string, r = 6) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * pr, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2 * pr;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    };
    ctx.save();
    ctx.font = `700 ${11 * pr}px Inter, system-ui, sans-serif`;
    app.georef.pairs.forEach((pair, i) => {
      const img = T(...apply(A, pair.pixel));
      const tgt = T(...forward(crs, pair.target));
      ctx.beginPath();
      ctx.moveTo(...img);
      ctx.lineTo(...tgt);
      ctx.strokeStyle = 'rgba(20,20,20,0.8)';
      ctx.lineWidth = 2 * pr;
      ctx.setLineDash([4 * pr, 3 * pr]);
      ctx.stroke();
      ctx.setLineDash([]);
      dot(img, '#2f80ff', 5);
      dot(tgt, '#ff6a2b', 6);
      ctx.fillStyle = '#111';
      ctx.fillText(String(i + 1), tgt[0] + 9 * pr, tgt[1] - 8 * pr);
    });
    const pending = app.georef.pendingPixel;
    if (pending) {
      const p = T(...apply(A, pending));
      dot(p, '#2f80ff', 7);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 13 * pr, 0, Math.PI * 2);
      ctx.strokeStyle = '#2f80ff';
      ctx.lineWidth = 2 * pr;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The exported scene, plus editor conveniences while a tool is active (full track, selection, all routes). */
  function previewScene(): SceneInput {
    const tl = app.timeline;
    const ps = app.projectScene;
    const editing = app.tool !== 'none';
    const editCourse =
      app.course && (app.courseStyle.visible || app.tool === 'course' || app.tool === 'route')
        ? {
            course: app.course,
            style: { ...app.courseStyle, visible: true },
            printScale: app.raster?.printScale ?? null,
            highlightLeg: app.tool === 'route' ? app.routeLeg : null,
            selectedId: app.tool === 'course' ? app.selectedPointId : null,
          }
        : null;
    if (!tl || !ps) {
      return { crsCode: app.crs.code, track: null, time: null, heading: null, style: app.style, course: editCourse };
    }
    const scene = sceneForFrame(tl.frameStateAt(app.time, app.frame), ps);
    if (!editing) return scene;
    const legRoutes =
      app.tool === 'route' && app.course
        ? routesForLeg(app.routes, app.course, app.routeLeg).map((r) => ({
            points: r.points,
            color: r.color,
            label: r.label,
            lengthText: formatRouteLength(routeLength(r)),
          }))
        : [];
    return {
      ...scene,
      style: { ...scene.style, track: { ...scene.style.track, showFuture: true } },
      course: editCourse,
      routes: app.tool === 'route' ? { items: legRoutes, alpha: 1 } : scene.routes,
    };
  }

  function applyFrame() {
    const tl = app.timeline;
    if (!map || !tl) return;
    const fs = tl.frameStateAt(app.time, app.frame);
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
    const uninstallTools = installTools(map);
    map.on('singleclick', (e) => {
      if (!app.georef.active || !app.raster) return;
      const crs = app.crs.code;
      const raster = app.raster;
      app.georefClick(
        e.coordinate as Pt,
        (xy) => viewToPixel(raster, crs, xy),
        (xy) => inverse(crs, xy),
      );
    });
    mapReady = true;

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
      (window as unknown as Record<string, unknown>).__omv = { app, map: () => map, forward };
    }
    return () => {
      cancelAnimationFrame(raf);
      uninstallTools();
      ro.disconnect();
      map?.setTarget(undefined);
    };
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    if (app.exporting) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) app.loadFiles(files);
  }

  const accept = '.gpx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.kmz,.kml,.prj,.jgw,.jpgw,.pgw,.pngw,.tfw,.gfw,.wld';
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
    class:georef={app.georef.active}
    class:tool={app.tool !== 'none'}
    style:width="{app.frame.width}px"
    style:height="{app.frame.height}px"
    data-testid="map-frame"
  >
    <div class="map" bind:this={mapEl}></div>
    <canvas class="overlay" bind:this={overlayEl} data-testid="overlay"></canvas>

    {#if !app.track && !app.raster}
      <div class="empty">
        <div class="card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M4 18c3-6 6 2 9-4s4-7 7-6" stroke-linecap="round" /><circle cx="4" cy="18" r="1.6" /><path
              d="m18 4 2 2-2 2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <h2>Drop a GPX file or a map image</h2>
          <p>
            GPX tracks, orienteering map images (JPG/PNG + world file) or KMZ. Files are processed on this device and
            never uploaded.
          </p>
          <div class="row">
            <label class="btn primary">
              Choose files…
              <input
                type="file"
                multiple
                {accept}
                hidden
                data-testid="file-input"
                onchange={(e) => {
                  const files = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
                  if (files.length) app.loadFiles(files);
                }}
              />
            </label>
            <button class="btn" onclick={() => app.loadSample()} data-testid="load-sample">Load sample GPX</button>
          </div>
          {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
        </div>
      </div>
    {/if}
    {#if dragging}<div class="dropzone">Drop GPX or map files</div>{/if}
    {#if app.georef.active}
      <div class="georef-hint" data-testid="georef-hint">
        {#if app.georef.pendingPixel}
          <b>Step 2:</b> click the true position of that point on the background map
        {:else}
          <b>Step 1:</b> click a distinctive point on your map image (e.g. a path crossing)
        {/if}
      </div>
    {/if}
    {#if !app.locked}
      <div
        class="resize"
        role="separator"
        aria-label="Resize frame (Shift keeps aspect ratio)"
        title="Drag to resize · Shift keeps the aspect ratio"
        data-testid="frame-resize"
        onpointerdown={onResizeDown}
        onpointermove={onResizeMove}
        onpointerup={onResizeUp}
        onpointercancel={onResizeUp}
      ></div>
    {/if}
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
  .frame.dragging,
  .frame.georef {
    box-shadow:
      0 0 0 2px var(--accent),
      var(--shadow);
  }
  .frame.tool .map,
  .frame.georef .map {
    cursor: crosshair;
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
  .resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    touch-action: none;
    background:
      linear-gradient(
        135deg,
        transparent 50%,
        rgba(255, 255, 255, 0.9) 50%,
        rgba(255, 255, 255, 0.9) 58%,
        transparent 58%
      ),
      linear-gradient(
        135deg,
        transparent 68%,
        rgba(255, 255, 255, 0.9) 68%,
        rgba(255, 255, 255, 0.9) 76%,
        transparent 76%
      ),
      rgba(13, 16, 20, 0.55);
    border-top-left-radius: 6px;
  }
  .georef-hint {
    position: absolute;
    left: 50%;
    top: 10px;
    transform: translateX(-50%);
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(13, 16, 20, 0.85);
    color: #fff;
    font-size: 12.5px;
    pointer-events: none;
    white-space: nowrap;
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
    max-width: 420px;
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
