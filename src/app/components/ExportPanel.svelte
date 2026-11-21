<script lang="ts">
  import { errorText, int, t } from '../i18n.svelte';
  import type { MsgKey } from '../../lib/i18n/core';
  /**
   * Export (STORY-9/10/11, EPIC-5): time range (STORY-35), outputs (map + data components, STORY-32), one-pass
   * package export into a folder or downloads (STORY-36), progress and results.
   */
  import { app, type ExportFileView } from '../state.svelte';
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
  import { firstFrameClock } from '../../lib/export/range';
  import { COMPONENT_META, isAvailable } from '../../lib/components/components';
  import { formatClock, formatDuration, parseDuration } from '../../lib/format';
  import type { LayerDesc } from '../../lib/map/layerModel';
  // Lazy: mediabunny + export code load only when needed.
  const exporter = () => import('../../lib/export/exporter');

  let abort: AbortController | null = null;
  let codecInfo = $state<string>('');
  let codecChecked = $state(false);
  let canExport = $state(false);

  const size = $derived(computeVideoSize(app.aspect, app.exportShortSide));
  const autoMbps = $derived(autoBitrateMbps(size.width, size.height, app.exportFps));
  const mbps = $derived(app.bitrateAuto ? autoMbps : app.bitrateMbps);
  const r = $derived(app.range);
  const frames = $derived(r ? frameCount(r.end - r.start, app.exportFps, app.speed) : 0);
  const videoSeconds = $derived(frames / app.exportFps);
  const comps = $derived(app.components.filter((c) => c.enabled && isAvailable(c.kind, app.track)));
  /** Components get a modest fixed bitrate: simple graphics. */
  const compMbps = (w: number, h: number) => Math.max(2, Math.round(autoBitrateMbps(w, h, app.exportFps) * 0.5));
  const outputs = $derived([
    ...(app.exportMap ? [{ id: 'map', kind: 'map', label: 'Map', width: size.width, height: size.height, mbps }] : []),
    ...comps.map((c) => ({
      id: c.kind,
      kind: c.kind,
      label: COMPONENT_META[c.kind].label,
      width: c.width,
      height: c.height,
      mbps: compMbps(c.width, c.height),
    })),
  ]);
  const totalBytes = $derived(outputs.reduce((s, o) => s + estimatedBytes(o.mbps, videoSeconds), 0));
  const clock0 = $derived(app.track && r ? firstFrameClock(app.track, r) : null);
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
        codecChecked = true;
        codecInfo = c ? `${c.codec === 'avc' ? 'H.264' : c.codec.toUpperCase()} · ${c.extension.toUpperCase()}` : '';
      });
  });

  function mb(bytes: number) {
    return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
  }

  function typedTime(e: Event, set: (t: number) => void) {
    const input = e.currentTarget as HTMLInputElement;
    const v = parseDuration(input.value);
    if (v !== null) set(v);
    else input.value = '';
  }

  async function start() {
    const tl = app.timeline;
    const track = app.track;
    const range = app.range;
    if (!tl || !track || !range || !app.projectScene || !outputs.length) return;
    app.playing = false;
    app.exportError = '';
    app.exportResult?.files.forEach((f) => URL.revokeObjectURL(f.url));
    app.exportResult = null;
    const ex = await exporter();
    // Codecs and names first, then destinations (one folder, or temporary files).
    type Planned = (typeof outputs)[number] & { codec: import('../../lib/export/exporter').CodecChoice; name: string };
    const planned: Planned[] = [];
    for (const o of outputs) {
      const codec = await ex.chooseCodec(o.width, o.height, o.mbps * 1e6);
      if (!codec) {
        app.exportError = t('ex.cannotEncode', { w: o.width, h: o.height });
        return;
      }
      const name = ex.videoFileName(track.name, app.exportFps, o.width, o.height, codec.extension, app.speed, o.id);
      planned.push({ ...o, codec, name });
    }
    let opened;
    try {
      opened = await ex.openPackageTargets(
        planned.map((p) => ({ name: p.name, codec: p.codec, bytes: estimatedBytes(p.mbps, videoSeconds) })),
      );
    } catch (e) {
      app.exportError = errorText(e);
      return;
    }
    if (!opened) return; // dialog cancelled
    app.exporting = true;
    abort = new AbortController();
    const t0 = performance.now();
    app.exportProgress = { done: 0, total: frames, startedAt: t0 };
    try {
      const res = await ex.exportPackage({
        timeline: tl,
        cssWidth: app.frame.width,
        cssHeight: app.frame.height,
        fps: app.exportFps,
        speed: app.speed,
        startT: range.start,
        endT: range.end,
        scene: app.projectScene,
        layers: $state.snapshot(app.layers) as LayerDesc[],
        raster: app.raster,
        origin: range.origin,
        passings: app.passings?.map((p) => p.t) ?? null,
        outputs: planned.map((p, i) => ({
          id: p.id,
          kind: p.kind as 'map',
          width: p.width,
          height: p.height,
          bitrateMbps: p.mbps,
          codec: p.codec,
          target: opened.targets[i],
          component: app.components.find((c) => c.kind === p.kind),
        })),
        signal: abort.signal,
        onProgress: (done, total) => {
          app.exportProgress = { done, total, startedAt: t0 };
        },
      });
      const files: ExportFileView[] = res.files.map((f, i) => ({
        id: f.id,
        kind: planned[i].kind,
        label: planned[i].label,
        url: URL.createObjectURL(f.file),
        file: f.file,
        name: planned[i].name,
        savedToDisk: opened.targets[i].savedToDisk,
      }));
      const info = {
        app: 'OMap Video',
        track: track.name,
        files: files.map((f) => f.name),
        fps: app.exportFps,
        speed: app.speed,
        frames: res.frames,
        durationSeconds: res.seconds,
        range: { start: range.start, end: range.end, mode: range.mode },
        firstFrameClock: clock0 === null ? null : new Date(clock0).toISOString(),
      };
      if (opened.folder) await ex.writeToFolder(opened.folder, 'export.json', JSON.stringify(info, null, 2));
      app.exportResult = {
        files,
        codec: planned[0].codec.codec,
        frames: res.frames,
        seconds: res.seconds,
        elapsedMs: performance.now() - t0,
        folder: opened.folder?.name ?? null,
        firstFrameClock: clock0,
      };
      app.toast(
        opened.folder
          ? t('ex.toastFolder', { n: files.length, name: opened.folder.name })
          : t('ex.toastDone', { n: files.length }),
        'ok',
      );
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') app.exportError = errorText(e);
    } finally {
      app.exporting = false;
      abort = null;
    }
  }

  async function download(f: ExportFileView) {
    (await exporter()).downloadFile(f.file, f.name);
  }
</script>

<section class="export section">
  <div class="sec-head">
    <h3 class="sec-title">{t('ex.title')}</h3>
    <span class="tag mono">{codecChecked ? codecInfo || t('ex.notSupported') : t('ex.checking')}</span>
  </div>

  <!-- Range (STORY-35) -->
  <div class="field">
    <span>{t('ex.timeRange')}</span>
    <div class="seg" role="group" aria-label={t('ex.rangeLabel')}>
      <button
        aria-pressed={app.exportRange.mode === 'course'}
        disabled={app.locked || !app.passings}
        onclick={() => (app.exportRange.mode = 'course')}
        data-testid="range-course"
      >
        {t('ex.startFinish')}
      </button>
      <button
        aria-pressed={r?.mode === 'track'}
        disabled={app.locked}
        onclick={() => (app.exportRange.mode = 'track')}
        data-testid="range-track"
      >
        {t('ex.wholeTrack')}
      </button>
      <button
        aria-pressed={app.exportRange.mode === 'custom'}
        disabled={app.locked || !app.track}
        onclick={() => app.setRangeIn(app.range ? app.range.start + app.exportRange.padBefore : 0)}
        data-testid="range-custom"
      >
        {t('ex.custom')}
      </button>
    </div>
  </div>
  {#if app.exportRange.mode === 'custom'}
    <div class="grid2">
      <label class="field">
        <span>
          {t('ex.from')}
          <button class="link" onclick={() => app.setRangeIn(app.time)} title={t('ex.setInTitle')}>
            {t('ex.playheadIn')}
          </button>
        </span>
        <input
          type="text"
          value={formatDuration(app.exportRange.in)}
          data-testid="range-in"
          disabled={app.locked}
          onchange={(e) => typedTime(e, (t) => app.setRangeIn(t))}
        />
      </label>
      <label class="field">
        <span>
          {t('ex.to')}
          <button class="link" onclick={() => app.setRangeOut(app.time)} title={t('ex.setOutTitle')}>
            {t('ex.playheadOut')}
          </button>
        </span>
        <input
          type="text"
          value={formatDuration(app.exportRange.out)}
          data-testid="range-out"
          disabled={app.locked}
          onchange={(e) => typedTime(e, (t) => app.setRangeOut(t))}
        />
      </label>
    </div>
  {/if}
  <div class="grid2">
    <label class="field">
      <span>{t('ex.leadIn')}</span>
      <input type="number" min="0" max="600" bind:value={app.exportRange.padBefore} disabled={app.locked} />
    </label>
    <label class="field">
      <span>{t('ex.leadOut')}</span>
      <input type="number" min="0" max="600" bind:value={app.exportRange.padAfter} disabled={app.locked} />
    </label>
  </div>

  <!-- Map video settings -->
  <label class="check">
    <input type="checkbox" bind:checked={app.exportMap} disabled={app.locked} data-testid="export-map" />
    {t('ex.mapVideo')}
  </label>
  <div class="grid2">
    <label class="field">
      <span>{t('ex.resolution')}</span>
      <select bind:value={app.exportShortSide} disabled={app.locked || !app.exportMap} data-testid="resolution">
        {#each SHORT_SIDES as s (s)}<option value={s}>{s}p</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>{t('ex.frameRate')}</span>
      <select bind:value={app.exportFps} disabled={app.locked} data-testid="fps">
        {#each FRAME_RATES as f (f)}<option value={f}>{f} fps</option>{/each}
      </select>
    </label>
  </div>
  <div class="field">
    <span>{t('ex.bitrate')}</span>
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
      <label class="check">
        <input type="checkbox" bind:checked={app.bitrateAuto} disabled={app.locked} />
        {t('ex.auto')}
      </label>
    </div>
  </div>

  <div class="summary mono" data-testid="export-summary">
    <div><span>{t('ex.mapVideo')}</span><b>{app.exportMap ? `${size.width} × ${size.height}` : '—'}</b></div>
    <div>
      <span>{t('ex.components')}</span><b>{comps.length ? comps.map((c) => t(`comp.${c.kind}`)).join(', ') : '—'}</b>
    </div>
    <div><span>{t('ex.range')}</span><b>{r ? `${formatDuration(r.start)} – ${formatDuration(r.end)}` : '—'}</b></div>
    <div>
      <span>{t('ex.length')}</span><b>{formatDuration(videoSeconds)} · {t('ex.frames', { n: int(frames) })}</b>
    </div>
    <div><span>{t('ex.speed')}</span><b>{app.speed}×</b></div>
    {#if clock0 !== null}<div title={t('ex.firstFrameTitle')}>
        <span>{t('ex.firstFrame')}</span><b data-testid="first-frame-clock">{formatClock(clock0)}</b>
      </div>{/if}
    <div>
      <span>{t('ex.estSize')}</span><b>
        ~{mb(totalBytes)} · {outputs.length === 1 ? t('ex.files1') : t('ex.files', { n: outputs.length })}
      </b>
    </div>
  </div>

  {#if app.exporting}
    <div class="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <div class="fill" style:width="{pct}%"></div>
    </div>
    <div class="row">
      <span class="mono muted small" data-testid="export-progress">
        {int(app.exportProgress.done)} / {int(app.exportProgress.total)} · {Math.floor(pct)} %
        {#if eta}{t('ex.left', { time: eta })}{/if}
      </span>
      <button class="btn" onclick={() => abort?.abort()}>{t('common.cancel')}</button>
    </div>
  {:else}
    <button
      class="btn primary wide"
      disabled={!app.track || !canExport || !outputs.length}
      onclick={start}
      data-testid="export"
    >
      {outputs.length === 1
        ? outputs[0].id === 'map'
          ? t('ex.exportMap', { p: size.height })
          : t('ex.export1')
        : t('ex.exportN', { n: outputs.length })}
    </button>
    {#if outputs.length > 1}
      <small class="muted">{t('ex.folderHelp')}</small>
    {/if}
    {#if codecChecked && !canExport}
      <p class="note err">{t('ex.noWebCodecs')}</p>
    {/if}
  {/if}
  {#if app.exportError}<p class="note err" role="alert">{app.exportError}</p>{/if}

  {#if app.exportResult}
    {@const res = app.exportResult}
    {@const mapFile = res.files.find((f) => f.kind === 'map') ?? res.files[0]}
    <div class="result" data-testid="export-result">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={mapFile.url} controls muted playsinline></video>
      <div class="mono small muted">
        {t('ex.resultLine', {
          n: int(res.frames),
          time: formatDuration(res.elapsedMs / 1000),
          x: (res.seconds / (res.elapsedMs / 1000)).toFixed(1),
        })}
        {#if res.folder}<br />{t('ex.savedFolder', { name: res.folder })}{/if}
      </div>
      <ul class="files" data-testid="export-files">
        {#each res.files as f (f.id)}
          <li>
            <span class="fname" title={f.name}>
              {f.kind === 'map' ? t('ex.mapLabel') : t(`comp.${f.kind}` as MsgKey)}
            </span>
            <span class="mono small muted">{mb(f.file.size)}</span>
            {#if f.savedToDisk}
              <span class="note ok" data-testid={f.kind === 'map' ? 'saved' : `saved-${f.id}`}>{t('ex.saved')}</span>
            {:else}
              <button
                class="btn sm"
                data-testid={f.kind === 'map' ? 'save' : `download-${f.id}`}
                onclick={() => download(f)}
              >
                {t('ex.download')}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .export {
    padding-bottom: 24px;
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
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font-size: 11.5px;
    padding: 0 0 0 4px;
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
    gap: 8px;
  }
  .summary span {
    color: var(--text-muted);
  }
  .summary b {
    font-weight: 600;
    text-align: right;
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
  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .files li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 8px;
  }
  .fname {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
