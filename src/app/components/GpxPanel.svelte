<script lang="ts">
  /** GPX tab: track summary (STORY-2) and the non-destructive GPX editor (STORY-21). */
  import { app } from '../state.svelte';
  import { formatClock, formatDistance, formatDuration } from '../../lib/format';
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
  <div class="sec-head"><h3 class="sec-title">Track</h3></div>
  {#if tr}
    <div data-testid="track-info">
      <strong class="name">{tr.name}</strong>
      <dl>
        <dt>Length</dt>
        <dd class="mono">{formatDistance(tr.length)}</dd>
        <dt>Duration</dt>
        <dd class="mono">{formatDuration(tr.duration)}</dd>
        <dt>Points</dt>
        <dd class="mono">{tr.points.length.toLocaleString('en')}</dd>
        <dt>Start</dt>
        <dd class="mono">{tr.startTime ? formatClock(tr.startTime) : '—'}</dd>
      </dl>
      <div class="chips">
        <span class="chip" class:on={channels?.time}>Time</span>
        <span class="chip" class:on={channels?.heartRate}>Heart rate</span>
        <span class="chip" class:on={channels?.elevation}>Elevation</span>
      </div>
      {#if !channels?.time}<p class="note warn">No timestamps: playback assumes 3 m/s.</p>{/if}
    </div>
    <label class="btn sm replace">
      Replace GPX…
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
    <p class="small muted">Load a GPX file to start. It stays on this device.</p>
    <label class="btn sm primary replace">
      Choose GPX…
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
      <h3 class="sec-title">Fix GPS errors</h3>
      <span class="tag" data-testid="edit-count">{app.gpxEdits.length} edits</span>
    </div>
    <button
      class="btn"
      class:primary={editing}
      aria-pressed={editing}
      disabled={app.locked}
      data-testid="gpx-edit"
      onclick={() => app.setTool('gpx')}
    >
      {editing ? 'Done editing' : 'Edit track on map'}
    </button>
    {#if editing}
      <ul class="help small muted">
        <li>Zoom in to see the track points. <b>Drag</b> a point to move it; nearby points follow within the brush.</li>
        <li>Click a point to select it; <kbd>Delete</kbd> removes it. Times are never changed.</li>
      </ul>
      <label class="field">
        <span>Brush · {app.brushRadius} m</span>
        <input type="range" min="0" max="60" step="5" bind:value={app.brushRadius} />
      </label>
      {#if app.selectedTrackIndex !== null}
        <div class="row">
          <span class="small mono">
            Point {app.selectedTrackIndex + 1} · {formatDuration(tr.points[app.selectedTrackIndex]?.t ?? 0)}
          </span>
          <button
            class="btn sm"
            onclick={() =>
              app.addGpxEdit({ type: 'delete', from: app.selectedTrackIndex!, to: app.selectedTrackIndex! })}
          >
            Delete point
          </button>
        </div>
      {/if}
    {/if}

    <div class="row">
      <span class="small">
        {outlierCount ? `${outlierCount} GPS spike${outlierCount > 1 ? 's' : ''} found` : 'No GPS spikes found'}
      </span>
      <button
        class="btn sm"
        disabled={!outlierCount || app.locked}
        onclick={() => app.removeOutliers()}
        data-testid="remove-outliers"
      >
        Remove
      </button>
    </div>

    <div class="range">
      <span class="small muted">Time range (set from the playhead)</span>
      <div class="row">
        <button class="btn sm" onclick={() => (app.editRange = [app.time, app.editRange[1]])} data-testid="range-a">
          From {app.editRange[0] !== null ? formatDuration(app.editRange[0]) : '…'}
        </button>
        <button class="btn sm" onclick={() => (app.editRange = [app.editRange[0], app.time])} data-testid="range-b">
          To {app.editRange[1] !== null ? formatDuration(app.editRange[1]) : '…'}
        </button>
        {#if app.editRange[0] !== null || app.editRange[1] !== null}
          <button class="btn ghost icon sm" aria-label="Clear range" onclick={() => (app.editRange = [null, null])}>
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
          Delete inside
        </button>
        <button
          class="btn sm"
          disabled={!range || app.locked}
          onclick={() => app.trimToRange()}
          data-testid="range-trim"
        >
          Trim to range
        </button>
        <button
          class="btn sm"
          class:primary={app.tool === 'gpx-redraw'}
          disabled={!range || app.locked}
          onclick={() => app.setTool('gpx-redraw')}
          data-testid="range-redraw"
        >
          Redraw…
        </button>
      </div>
      {#if app.tool === 'gpx-redraw'}
        <p class="note warn">
          Click the route you ran between the range ends; double-click or press <kbd>Enter</kbd> to apply,
          <kbd>Esc</kbd>
          to cancel. Times are spread along the new line.
        </p>
      {/if}
    </div>

    {#if app.passings}
      <button
        class="btn sm"
        onclick={snapToControls}
        disabled={app.locked}
        title="Moves the track so it passes exactly through each found control"
      >
        Snap track to controls
      </button>
    {/if}

    <div class="row">
      <label class="check"><input type="checkbox" bind:checked={app.showOriginalGpx} /> Show original</label>
      <button class="btn sm ghost" disabled={!app.gpxEdits.length} onclick={() => app.resetGpxEdits()}>
        Reset all edits
      </button>
    </div>
    <div class="row">
      <button class="btn sm ghost" disabled={!app.canUndo} onclick={() => app.undo()} title="Undo (⌘/Ctrl Z)">
        ↶ Undo
      </button>
      <button class="btn sm ghost" disabled={!app.canRedo} onclick={() => app.redo()} title="Redo (⇧⌘/Ctrl Z)">
        ↷ Redo
      </button>
      <button class="btn sm" onclick={exportGpx} data-testid="gpx-export">Export edited GPX</button>
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
  kbd {
    font-family: var(--mono);
    font-size: 11px;
    padding: 0 4px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
  }
</style>
