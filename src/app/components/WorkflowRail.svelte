<script lang="ts">
  /** Guided workflow rail (STORY-37): numbered steps with completion state; selects the inspector panel. */
  import { app, type InspectorTab } from '../state.svelte';
  import { courseProblems } from '../../lib/course/course';

  type Status = 'done' | 'todo' | 'optional' | 'warn';
  const steps = $derived<{ id: InspectorTab; n: number; label: string; hint: string; status: Status }[]>([
    {
      id: 'map',
      n: 1,
      label: 'Map',
      hint: 'Background map and your orienteering map',
      status: app.raster ? (app.raster.georef.source === 'placed' ? 'warn' : 'done') : 'optional',
    },
    { id: 'gpx', n: 2, label: 'GPX', hint: 'Load your track and fix GPS errors', status: app.track ? 'done' : 'todo' },
    {
      id: 'course',
      n: 3,
      label: 'Course',
      hint: 'Start, controls, finish and split times',
      status: !app.course ? 'optional' : courseProblems(app.course).length ? 'warn' : app.passings ? 'done' : 'warn',
    },
    {
      id: 'routes',
      n: 4,
      label: 'Routes',
      hint: 'Route choices per leg',
      status: app.routes.length ? 'done' : 'optional',
    },
    { id: 'style', n: 5, label: 'Style', hint: 'Camera, course, runner and frame', status: 'optional' },
    {
      id: 'export',
      n: 6,
      label: 'Export',
      hint: 'Data videos and export',
      status: app.exportResult ? 'done' : app.track ? 'todo' : 'optional',
    },
  ]);
  const title: Record<Status, string> = { done: 'Done', todo: 'To do', optional: 'Optional', warn: 'Needs attention' };
</script>

<nav class="rail" aria-label="Workflow">
  {#each steps as s (s.id)}
    <button
      class="step {s.status}"
      aria-current={app.inspectorTab === s.id ? 'step' : undefined}
      data-testid="tab-{s.id}"
      title="{s.n}. {s.label} – {s.hint} ({title[s.status]})"
      onclick={() => app.setInspectorTab(s.id)}
    >
      <span class="num">
        {#if s.status === 'done'}✓{:else if s.status === 'warn'}!{:else}{s.n}{/if}
      </span>
      <span class="label">{s.label}</span>
    </button>
  {/each}
</nav>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 8px;
    border-right: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .step {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 9px 4px 8px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 600;
  }
  .step:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .step[aria-current='step'] {
    background: var(--accent-soft);
    color: var(--text);
  }
  .num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--border-strong);
    font-size: 12.5px;
    font-weight: 700;
  }
  .step[aria-current='step'] .num {
    border-color: var(--accent);
    color: var(--accent);
  }
  .done .num {
    background: var(--ok);
    border-color: var(--ok);
    color: #06130c;
  }
  .warn .num {
    border-color: var(--warn);
    color: var(--warn);
  }
  .todo .num {
    border-style: dashed;
  }
</style>
