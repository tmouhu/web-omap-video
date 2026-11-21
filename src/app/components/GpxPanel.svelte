<script lang="ts">
  import { dist, int, t } from '../i18n.svelte';
  /** GPX tab: track summary (STORY-2) and the non-destructive GPX editor (STORY-21). */
  import { app } from '../state.svelte';
  import { formatClock, formatDuration } from '../../lib/format';
  import { writeGpx } from '../../lib/gpx/write';

  const tr = $derived(app.track);
  const channels = $derived(tr?.channels);
  const editing = $derived(app.tool === 'gpx' || app.tool === 'gpx-redraw');
  const outlierCount = $derived.by(() => {
    void app.gpxEdits;
    return app.gpx ? app.outliers().length : 0;
  });
  const range = $derived(app.rangeIndices());

  function exportGpx() {
    if (!app.gpx) return;
    const blob = new Blob([writeGpx(app.gpxName, app.editedGpxPoints())], { type: 'application/gpx+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${app.gpxName.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'track'}_edited.gpx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  function snapToControls() {
    const c = app.course;
    const ps = app.passings;
    if (!c || !ps) return;
    const edits = ps
      .map((p, k) => ({ p, pt: c.points[k] }))
      .filter(({ p }) => p.status === 'auto' || p.status === 'manual')
      .map(({ p, pt }) => ({
        type: 'move' as const,
        index: app.indexAtTime(p.t),
        lat: pt.lat,
        lon: pt.lon,
        radius: Math.max(app.brushRadius, 10),
      }));
    if (edits.length) app.addGpxEdit(edits);
  }
</script>

<section class="section">
  <div class="sec-head"><h3 class="sec-title">{t('gpx.track')}</h3></div>
  {#if tr}
    <div data-testid="track-info">
      <strong class="name">{tr.name}</strong>
      <dl>
        <dt>{t('gpx.length')}</dt>
        <dd class="mono">{dist(tr.length)}</dd>
        <dt>{t('gpx.duration')}</dt>
        <dd class="mono">{formatDuration(tr.duration)}</dd>
        <dt>{t('gpx.points')}</dt>
        <dd class="mono">{int(tr.points.length)}</dd>
        <dt>{t('gpx.start')}</dt>
        <dd class="mono">{tr.startTime ? formatClock(tr.startTime) : '—'}</dd>
      </dl>
      <div class="chips">
        <span class="chip" class:on={channels?.time}>{t('gpx.chTime')}</span>
        <span class="chip" class:on={channels?.heartRate}>{t('gpx.chHr')}</span>
        <span class="chip" class:on={channels?.elevation}>{t('gpx.chEle')}</span>
      </div>
      {#if !channels?.time}<p class="note warn">{t('gpx.noTime')}</p>{/if}
    </div>
    <label class="btn sm replace">
      {t('gpx.replace')}
      <input
        type="file"
        accept=".gpx,application/gpx+xml"
        hidden
        disabled={app.exporting}
        onchange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) app.loadFiles([f]);
        }}
      />
    </label>
  {:else}
    <p class="small muted">{t('gpx.loadHint')}</p>
    <label class="btn sm primary replace">
      {t('gpx.choose')}
      <input
        type="file"
        accept=".gpx,application/gpx+xml"
        hidden
        onchange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) app.loadFiles([f]);
        }}
      />
    </label>
  {/if}
  {#if app.error}<p class="note err" role="alert">{app.error}</p>{/if}
</section>

{#if tr}
  <section class="section" data-testid="gpx-editor">
    <div class="sec-head">
      <h3 class="sec-title">{t('gpx.fixTitle')}</h3>
      <span class="tag" data-testid="edit-count">{t('gpx.edits', { n: app.gpxEdits.length })}</span>
    </div>
    <button
      class="btn"
      class:primary={editing}
      aria-pressed={editing}
      disabled={app.locked}
      data-testid="gpx-edit"
      onclick={() => app.setTool('gpx')}
    >
      {editing ? t('gpx.doneEditing') : t('gpx.edit')}
    </button>
    {#if editing}
      <ul class="help small muted">
        <li>{@html t('gpx.help1')}</li>
        <li>{@html t('gpx.help2')}</li>
      </ul>
      <label class="field">
        <span>{t('gpx.brush', { m: app.brushRadius })}</span>
        <input type="range" min="0" max="60" step="5" bind:value={app.brushRadius} />
      </label>
      {#if app.selectedTrackIndex !== null}
        <div class="row">
          <span class="small mono">
            {t('gpx.point', {
              n: app.selectedTrackIndex + 1,
              time: formatDuration(tr.points[app.selectedTrackIndex]?.t ?? 0),
            })}
          </span>
          <button
            class="btn sm"
            onclick={() =>
              app.addGpxEdit({ type: 'delete', from: app.selectedTrackIndex!, to: app.selectedTrackIndex! })}
          >
            {t('gpx.deletePoint')}
          </button>
        </div>
      {/if}
    {/if}

    <div class="row">
      <span class="small">
        {outlierCount === 1 ? t('gpx.spike1') : outlierCount ? t('gpx.spikes', { n: outlierCount }) : t('gpx.noSpikes')}
      </span>
      <button
        class="btn sm"
        disabled={!outlierCount || app.locked}
        onclick={() => app.removeOutliers()}
        data-testid="remove-outliers"
      >
        {t('gpx.remove')}
      </button>
    </div>

    <div class="range">
      <span class="small muted">{t('gpx.rangeTitle')}</span>
      <div class="row">
        <button class="btn sm" onclick={() => (app.editRange = [app.time, app.editRange[1]])} data-testid="range-a">
          {t('gpx.from', { time: app.editRange[0] !== null ? formatDuration(app.editRange[0]) : '…' })}
        </button>
        <button class="btn sm" onclick={() => (app.editRange = [app.editRange[0], app.time])} data-testid="range-b">
          {t('gpx.to', { time: app.editRange[1] !== null ? formatDuration(app.editRange[1]) : '…' })}
        </button>
        {#if app.editRange[0] !== null || app.editRange[1] !== null}
          <button
            class="btn ghost icon sm"
            aria-label={t('gpx.clearRange')}
            onclick={() => (app.editRange = [null, null])}
          >
            ✕
          </button>
        {/if}
      </div>
      <div class="row">
        <button
          class="btn sm"
          disabled={!range || app.locked}
          onclick={() => app.deleteRange()}
          data-testid="range-delete"
        >
          {t('gpx.deleteInside')}
        </button>
        <button
          class="btn sm"
          disabled={!range || app.locked}
          onclick={() => app.trimToRange()}
          data-testid="range-trim"
        >
          {t('gpx.trim')}
        </button>
        <button
          class="btn sm"
          class:primary={app.tool === 'gpx-redraw'}
          disabled={!range || app.locked}
          onclick={() => app.setTool('gpx-redraw')}
          data-testid="range-redraw"
        >
          {t('gpx.redraw')}
        </button>
      </div>
      {#if app.tool === 'gpx-redraw'}
        <p class="note warn">
          {@html t('gpx.redrawHelp')}
        </p>
      {/if}
    </div>

    {#if app.passings}
      <button class="btn sm" onclick={snapToControls} disabled={app.locked} title={t('gpx.snapTitle')}>
        {t('gpx.snap')}
      </button>
    {/if}

    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={app.showOriginalGpx} /> {t('gpx.showOriginal')}</label>
      <button class="btn sm ghost" disabled={!app.gpxEdits.length} onclick={() => app.resetGpxEdits()}>
        {t('gpx.reset')}
      </button>
    </div>
    <div class="row">
      <button class="btn sm ghost" disabled={!app.canUndo} onclick={() => app.undo()} title={t('app.undoTitle')}>
        {t('gpx.undo')}
      </button>
      <button class="btn sm ghost" disabled={!app.canRedo} onclick={() => app.redo()} title={t('app.redoTitle')}>
        {t('gpx.redo')}
      </button>
      <button class="btn sm" onclick={exportGpx} data-testid="gpx-export">{t('gpx.export')}</button>
    </div>
  </section>
{/if}

<style>
  .name {
    font-size: 15px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 8px 0 10px;
    font-size: 13px;
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
    text-align: right;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    font-size: 11.5px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--text-faint);
    text-decoration: line-through;
  }
  .chip.on {
    color: var(--ok);
    border-color: color-mix(in srgb, var(--ok) 40%, transparent);
    text-decoration: none;
  }
  .replace {
    justify-self: start;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
  }
  .range {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .range .row {
    justify-content: flex-start;
  }
  .help {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 2px;
  }
</style>
