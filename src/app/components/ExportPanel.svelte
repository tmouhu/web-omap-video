<script lang="ts">
  /** Export settings, progress and result (STORY-9/10/11). */
  import { app } from '../state.svelte';
  import {
    autoBitrateMbps,
    computeVideoSize,
    estimatedBytes,
    FRAME_RATES,
    frameCount,
    MAX_BITRATE_MBPS,
    MIN_BITRATE_MBPS,
    SHORT_SIDES,
  } from '../../lib/export/videoSize';
  // Lazy: mediabunny + export code load only when the export panel needs them.
  const exporter = () => import('../../lib/export/exporter');
  import { formatDuration } from '../../lib/format';

  let abort: AbortController | null = null;
  let codecInfo = $state<string>('checking…');
  let canExport = $state(false);

  const size = $derived(computeVideoSize(app.aspect, app.exportShortSide));
  const autoMbps = $derived(autoBitrateMbps(size.width, size.height, app.exportFps));
  const mbps = $derived(app.bitrateAuto ? autoMbps : app.bitrateMbps);
  const startT = $derived(app.exportFromStart ? 0 : app.time);
  const range = $derived(app.track ? Math.max(0, app.track.duration - startT) : 0);
  const frames = $derived(app.track ? frameCount(range, app.exportFps, app.speed) : 0);
  const videoSeconds = $derived(frames / app.exportFps);
  const pct = $derived(app.exportProgress.total ? (app.exportProgress.done / app.exportProgress.total) * 100 : 0);
  const eta = $derived.by(() => {
    const { done, total, startedAt } = app.exportProgress;
    if (!done || !startedAt) return '';
    const per = (performance.now() - startedAt) / done;
    return formatDuration(((total - done) * per) / 1000);
  });

  $effect(() => {
    const { width, height } = size;
    exporter()
      .then((m) => m.chooseCodec(width, height))
      .then((c) => {
        canExport = !!c;
        codecInfo = c
          ? `${c.codec === 'avc' ? 'H.264' : c.codec.toUpperCase()} · ${c.extension.toUpperCase()}`
          : 'not supported';
      });
  });

  function mb(bytes: number) {
    return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
  }

  async function start() {
    const tl = app.timeline;
    if (!tl || !app.track) return;
    app.playing = false;
    app.exportError = '';
    if (app.exportResult) URL.revokeObjectURL(app.exportResult.url);
    app.exportResult = null;
    const { exportVideo, videoFileName, chooseCodec, openExportTarget } = await exporter();
    const codec = await chooseCodec(size.width, size.height, mbps * 1e6);
    if (!codec) {
      app.exportError = 'This browser cannot encode this video with WebCodecs. Use a recent Chrome or Edge.';
      return;
    }
    const name = videoFileName(tl.track.name, app.exportFps, size.width, size.height, codec.extension, app.speed);
    let target;
    try {
      // Destination first (STORY-11): the video streams to disk while it renders.
      target = await openExportTarget(name, codec, estimatedBytes(mbps, videoSeconds));
    } catch (e) {
      app.exportError = (e as Error).message;
      return;
    }
    if (!target) return; // "Save as" cancelled
    app.exporting = true;
    abort = new AbortController();
    const t0 = performance.now();
    app.exportProgress = { done: 0, total: frames, startedAt: t0 };
    try {
      const r = await exportVideo({
        codec,
        target,
        timeline: tl,
        width: size.width,
        height: size.height,
        cssWidth: app.frame.width,
        cssHeight: app.frame.height,
        fps: app.exportFps,
        speed: app.speed,
        startT,
        endT: app.track.duration,
        bitrateMbps: mbps,
        sceneStyle: $state.snapshot(app.style),
        signal: abort.signal,
        onProgress: (done, total) => {
          app.exportProgress = { done, total, startedAt: t0 };
        },
      });
      app.exportResult = {
        url: URL.createObjectURL(r.file),
        file: r.file,
        name: target.savedToDisk ? target.name : name,
        savedToDisk: target.savedToDisk,
        codec: codec.codec,
        frames: r.frames,
        seconds: r.seconds,
        elapsedMs: performance.now() - t0,
      };
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') app.exportError = (e as Error).message;
    } finally {
      app.exporting = false;
      abort = null;
    }
  }
</script>

<section class="export">
  <header>
    <h3>Export video</h3>
    <span class="tag mono">{codecInfo}</span>
  </header>

  <div class="grid2">
    <label class="field">
      <span>Resolution</span>
      <select bind:value={app.exportShortSide} disabled={app.locked} data-testid="resolution">
        {#each SHORT_SIDES as s (s)}<option value={s}>{s}p</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>Frame rate</span>
      <select bind:value={app.exportFps} disabled={app.locked} data-testid="fps">
        {#each FRAME_RATES as f (f)}<option value={f}>{f} fps</option>{/each}
      </select>
    </label>
  </div>

  <div class="field">
    <span>Bitrate</span>
    <div class="bitrate">
      <input
        type="number"
        min={MIN_BITRATE_MBPS}
        max={MAX_BITRATE_MBPS}
        value={mbps}
        disabled={app.bitrateAuto || app.locked}
        onchange={(e) => {
          const v = +(e.currentTarget as HTMLInputElement).value;
          app.bitrateMbps = Math.min(MAX_BITRATE_MBPS, Math.max(MIN_BITRATE_MBPS, v || autoMbps));
        }}
      />
      <span class="muted">Mbit/s</span>
      <label class="check"><input type="checkbox" bind:checked={app.bitrateAuto} disabled={app.locked} /> Auto</label>
    </div>
  </div>

  <label class="check">
    <input type="checkbox" bind:checked={app.exportFromStart} disabled={app.locked} /> From track start (otherwise from playhead)
  </label>

  <div class="summary mono" data-testid="export-summary">
    <div><span>Video</span><b>{size.width} × {size.height}</b></div>
    <div><span>Length</span><b>{formatDuration(videoSeconds)} · {frames.toLocaleString('en')} frames</b></div>
    <div><span>Speed</span><b>{app.speed}×</b></div>
    <div><span>Est. size</span><b>~{mb(estimatedBytes(mbps, videoSeconds))}</b></div>
  </div>

  {#if app.exporting}
    <div class="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <div class="fill" style:width="{pct}%"></div>
    </div>
    <div class="row">
      <span class="mono muted small" data-testid="export-progress">
        {app.exportProgress.done.toLocaleString('en')} / {app.exportProgress.total.toLocaleString('en')} · {Math.floor(
          pct,
        )} %
        {#if eta}· {eta} left{/if}
      </span>
      <button class="btn" onclick={() => abort?.abort()}>Cancel</button>
    </div>
  {:else}
    <button class="btn primary wide" disabled={!app.track || !canExport} onclick={start} data-testid="export">
      Export {size.height}p video
    </button>
    {#if !canExport && codecInfo === 'not supported'}
      <p class="note err">This browser cannot encode video (WebCodecs). Use a recent Chrome or Edge.</p>
    {/if}
  {/if}
  {#if app.exportError}<p class="note err" role="alert">{app.exportError}</p>{/if}

  {#if app.exportResult}
    {@const r = app.exportResult}
    <div class="result" data-testid="export-result">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={r.url} controls muted playsinline></video>
      <div class="mono small muted">
        {r.name}<br />
        {mb(r.file.size)} · {r.frames.toLocaleString('en')} frames · exported in {formatDuration(r.elapsedMs / 1000)}
        ({(r.seconds / (r.elapsedMs / 1000)).toFixed(1)}× real time)
      </div>
      {#if r.savedToDisk}
        <p class="note ok" data-testid="saved">✓ Saved to “{r.name}”</p>
      {:else}
        <button
          class="btn primary wide"
          data-testid="save"
          onclick={async () => (await exporter()).downloadFile(r.file, r.name)}
        >
          Download video
        </button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .export {
    padding: 16px 18px 24px;
    display: grid;
    gap: 12px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 600;
  }
  .tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .bitrate {
    display: grid;
    grid-template-columns: 90px auto 1fr;
    align-items: center;
    gap: 8px;
  }
  .bitrate .check {
    justify-self: end;
  }
  .summary {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--bg-input);
    border: 1px solid var(--border);
    font-size: 12px;
  }
  .summary div {
    display: flex;
    justify-content: space-between;
  }
  .summary span {
    color: var(--text-muted);
  }
  .summary b {
    font-weight: 600;
  }
  .wide {
    width: 100%;
    height: 38px;
  }
  .progress {
    height: 8px;
    border-radius: 99px;
    background: var(--bg-input);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
    transition: width 0.2s;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .small {
    font-size: 11.5px;
  }
  .note {
    margin: 0;
    font-size: 12.5px;
  }
  .err {
    color: var(--danger);
  }
  .ok {
    color: var(--ok);
  }
  .result {
    display: grid;
    gap: 8px;
  }
  video {
    width: 100%;
    border-radius: var(--radius-sm);
    background: #000;
    border: 1px solid var(--border);
  }
</style>
