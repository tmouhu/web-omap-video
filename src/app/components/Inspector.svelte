<script lang="ts">
  /** Right-hand inspector with tabs: Map (EPIC-2), Course (EPIC-3), GPX (STORY-2/21), Video (camera, frame, export). */
  import { app, ASPECTS, SCALE_PRESETS, type InspectorTab } from '../state.svelte';
  import { courseProblems } from '../../lib/course/course';
  import CoursePanel from './CoursePanel.svelte';
  import ExportPanel from './ExportPanel.svelte';
  import GpxPanel from './GpxPanel.svelte';
  import MapPanel from './MapPanel.svelte';

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'course', label: 'Course' },
    { id: 'gpx', label: 'GPX' },
    { id: 'video', label: 'Video' },
  ];
  const status = $derived<Record<InspectorTab, 'ok' | 'todo' | ''>>({
    map: app.raster ? 'ok' : '',
    course: app.course ? (courseProblems(app.course).length ? 'todo' : 'ok') : '',
    gpx: app.track ? 'ok' : 'todo',
    video: '',
  });
</script>

<aside class="inspector" aria-label="Settings">
  <div class="tabs" role="tablist" aria-label="Inspector sections">
    {#each tabs as t (t.id)}
      <button
        role="tab"
        aria-selected={app.inspectorTab === t.id}
        data-testid="tab-{t.id}"
        onclick={() => app.setInspectorTab(t.id)}
      >
        {t.label}
        {#if status[t.id]}<span class="dot {status[t.id]}"></span>{/if}
      </button>
    {/each}
  </div>

  {#if app.inspectorTab === 'map'}
    <MapPanel />
  {:else if app.inspectorTab === 'course'}
    <CoursePanel />
  {:else if app.inspectorTab === 'gpx'}
    <GpxPanel />
  {:else}
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
            onclick={() => app.setAspect(a.value)}
          >
            {a.label}
          </button>
        {/each}
        <button aria-pressed={!!app.frameCustom} disabled title="Drag the frame's corner to resize freely">Free</button>
      </div>
      <div class="size">
        <input
          type="number"
          aria-label="Frame width (px)"
          data-testid="frame-width"
          min="160"
          value={app.frame.width}
          disabled={app.locked}
          onchange={(e) => app.setFrameSize(+(e.currentTarget as HTMLInputElement).value, app.frame.height)}
        />
        <span class="muted">×</span>
        <input
          type="number"
          aria-label="Frame height (px)"
          data-testid="frame-height"
          min="90"
          value={app.frame.height}
          disabled={app.locked}
          onchange={(e) => app.setFrameSize(app.frame.width, +(e.currentTarget as HTMLInputElement).value)}
        />
        <span class="muted mono small">{(app.frame.width / Math.max(1, app.frame.height)).toFixed(3)}:1</span>
      </div>
      <small class="muted">
        Drag the frame's corner to resize (Shift keeps the ratio). The video shows the same area.
      </small>
    </section>

    <section>
      <header><h3>Overlays</h3></header>
      <label class="check">
        <input type="checkbox" bind:checked={app.style.showNorthArrow} disabled={app.locked} /> North arrow
      </label>
      <small class="muted">The video shows only the map, the route and the runner.</small>
    </section>

    <ExportPanel />
  {/if}
</aside>

<style>
  .inspector {
    overflow-y: auto;
    border-left: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .tabs {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    padding: 8px 10px 0;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    position: relative;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    padding: 9px 4px 10px;
    font-weight: 600;
    font-size: 13px;
    border-bottom: 2px solid transparent;
  }
  .tabs button[aria-selected='true'] {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: 4px;
    vertical-align: middle;
  }
  .dot.ok {
    background: var(--ok);
  }
  .dot.todo {
    background: var(--warn);
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
  .size {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    align-items: center;
    gap: 6px;
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
