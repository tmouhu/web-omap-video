<script lang="ts">
  /** Right-hand inspector: track summary, camera, frame and overlay settings, export. */
  import { app, ASPECTS, SCALE_PRESETS } from '../state.svelte';
  import { formatClock, formatDistance, formatDuration } from '../../lib/format';
  import ExportPanel from './ExportPanel.svelte';

  const channels = $derived(app.track?.channels);
</script>

<aside class="inspector" aria-label="Settings">
  <section>
    <header><h3>Track</h3></header>
    {#if app.track}
      <div class="track" data-testid="track-info">
        <strong class="name">{app.track.name}</strong>
        <dl>
          <dt>Length</dt>
          <dd class="mono">{formatDistance(app.track.length)}</dd>
          <dt>Duration</dt>
          <dd class="mono">{formatDuration(app.track.duration)}</dd>
          <dt>Points</dt>
          <dd class="mono">{app.track.points.length.toLocaleString('en')}</dd>
          <dt>Start</dt>
          <dd class="mono">{app.track.startTime ? formatClock(app.track.startTime) : '—'}</dd>
        </dl>
        <div class="chips">
          <span class="chip" class:on={channels?.time}>Time</span>
          <span class="chip" class:on={channels?.heartRate}>Heart rate</span>
          <span class="chip" class:on={channels?.elevation}>Elevation</span>
        </div>
        {#if !channels?.time}
          <p class="note warn">No timestamps: playback assumes 3 m/s.</p>
        {/if}
      </div>
      <label class="btn replace">
        Replace GPX…
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          hidden
          disabled={app.exporting}
          onchange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) app.loadFile(f);
          }}
        />
      </label>
      {#if app.error}<p class="note err" role="alert">{app.error}</p>{/if}
    {:else}
      <p class="muted small">Load a GPX file to start. It stays on this device.</p>
    {/if}
  </section>

  <section>
    <header>
      <h3>Camera</h3>
      <span class="tag">Free mode</span>
    </header>
    <div class="field">
      <span>Map scale</span>
      <div class="scale">
        <span class="mono muted">1:</span>
        <input
          type="number"
          min="500"
          max="200000"
          step="500"
          value={app.free.scale}
          disabled={app.locked}
          data-testid="scale"
          onchange={(e) => {
            const v = +(e.currentTarget as HTMLInputElement).value;
            app.free.scale = Math.min(200000, Math.max(500, Number.isFinite(v) ? v : 10000));
          }}
        />
        <select
          aria-label="Scale presets"
          disabled={app.locked}
          value=""
          onchange={(e) => {
            const v = +(e.currentTarget as HTMLSelectElement).value;
            if (v) app.free.scale = v;
            (e.currentTarget as HTMLSelectElement).value = '';
          }}
        >
          <option value="">Presets</option>
          {#each SCALE_PRESETS as s (s)}<option value={s}>1:{s.toLocaleString('en')}</option>{/each}
        </select>
      </div>
      <small class="muted">At 96 px per inch on the preview frame.</small>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={app.free.headingUp} disabled={app.locked} /> Heading up while playing
    </label>
    <div class="field">
      <span>Look-ahead · {Math.round(app.free.lookAhead * 100)} % below centre</span>
      <input type="range" min="0" max="0.4" step="0.05" bind:value={app.free.lookAhead} disabled={app.locked} />
    </div>
  </section>

  <section>
    <header><h3>Frame</h3></header>
    <div class="seg" role="group" aria-label="Aspect ratio">
      {#each ASPECTS as a (a.label)}
        <button
          aria-pressed={Math.abs(app.aspect - a.value) < 1e-6}
          disabled={app.locked}
          onclick={() => (app.aspect = a.value)}
        >
          {a.label}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <header><h3>Overlays</h3></header>
    <label class="check">
      <input type="checkbox" bind:checked={app.style.showInfo} disabled={app.locked} /> Info box (time, distance, pace)
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={app.style.showNorthArrow} disabled={app.locked} /> North arrow
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={app.style.showScaleBar} disabled={app.locked} /> Scale bar
    </label>
    <small class="muted">Map attribution is always shown (licence requirement).</small>
  </section>

  <ExportPanel />
</aside>

<style>
  .inspector {
    overflow-y: auto;
    border-left: 1px solid var(--border);
    background: var(--bg-elev);
  }
  section {
    padding: 16px 18px;
    border-bottom: 1px solid var(--border);
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
  .note {
    margin: 8px 0 0;
    font-size: 12.5px;
  }
  .warn {
    color: var(--warn);
  }
  .err {
    color: var(--danger);
  }
  .small {
    font-size: 13px;
    margin: 0;
  }
  .replace {
    justify-self: start;
  }
  .scale {
    display: grid;
    grid-template-columns: auto 1fr 110px;
    align-items: center;
    gap: 6px;
  }
  small {
    font-size: 11.5px;
  }
</style>
