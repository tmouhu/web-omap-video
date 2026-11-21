<script lang="ts">
  /** Course tab (EPIC-3): course editor (STORY-18), overprint style (STORY-19), IOF XML (STORY-20), splits (STORY-22/23). */
  import { app } from '../state.svelte';
  import { courseLength, courseProblems, legs, pointLabel } from '../../lib/course/course';
  import { writeIofCourseData } from '../../lib/course/iofxml';
  import { formatDistance, formatDuration } from '../../lib/format';
  import type { PassingStatus } from '../../lib/course/match';

  const c = $derived(app.course);
  const problems = $derived(courseProblems(c));
  const legList = $derived(c ? legs(c) : []);
  const ps = $derived(app.passings);
  const editing = $derived(app.tool === 'course');

  const STATUS: Record<PassingStatus, { label: string; cls: string; title: string }> = {
    auto: { label: '●', cls: 'ok', title: 'Found automatically' },
    manual: { label: '✎', cls: 'manual', title: 'Set manually' },
    'not-found': { label: '?', cls: 'bad', title: 'Not found within the search radius – estimated' },
    'start-of-track': { label: '⇤', cls: 'warn', title: 'Not found – using the start of the track' },
    'end-of-track': { label: '⇥', cls: 'warn', title: 'Not found – using the end of the track' },
  };

  function importXml(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) f.text().then((t) => app.importCourseXml(t));
  }

  function exportXml() {
    if (!c) return;
    const blob = new Blob([writeIofCourseData(c, app.raster?.printScale ?? null)], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${c.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'course'}.xml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  function nudge(id: string, t: number) {
    app.courseError = app.setPassing(id, t) ?? '';
  }

  /** Elapsed time from the start passing. */
  const rel = (t: number) => (ps ? t - ps[0].t : t);
</script>

<section class="section" data-testid="course-panel">
  <div class="sec-head">
    <h3 class="sec-title">Course</h3>
    {#if c}
      <span class="tag" class:valid={!problems.length} data-testid="course-status">
        {problems.length ? 'incomplete' : `${legList.length} legs · ${formatDistance(courseLength(c))}`}
      </span>
    {/if}
  </div>

  <button
    class="btn"
    class:primary={editing}
    aria-pressed={editing}
    disabled={app.locked}
    data-testid="course-edit"
    onclick={() => app.setTool('course')}
  >
    {editing ? 'Done editing' : c ? 'Edit course on map' : 'Draw course on map'}
  </button>
  {#if editing}
    <ul class="help small muted">
      <li>Click to place the <b>start</b>, then the <b>controls</b> in order.</li>
      <li><b>Double-click</b> to place the <b>finish</b>.</li>
      <li>Drag a symbol to move it · click a leg line to insert a control.</li>
      <li>Select a symbol and press <kbd>Delete</kbd> to remove it · <kbd>⌘/Ctrl Z</kbd> undoes.</li>
    </ul>
  {/if}
  {#if problems.length && c}<p class="note warn">{problems[0]}</p>{/if}

  <div class="row gap">
    <label class="btn sm">
      Import IOF XML…
      <input
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        onchange={importXml}
        data-testid="course-import"
      />
    </label>
    <button class="btn sm ghost" disabled={!c || !!problems.length} onclick={exportXml}>Export XML</button>
    {#if c}<button class="btn sm ghost" onclick={() => app.clearCourse()} disabled={app.locked}>Clear</button>{/if}
  </div>
  {#if app.importedCourses.length}
    <div class="pick" data-testid="course-choices">
      <span class="small muted">The file has {app.importedCourses.length} courses. Choose yours:</span>
      {#each app.importedCourses as ic (ic.name)}
        <button class="btn sm" onclick={() => app.useImportedCourse(ic)}>
          {ic.name} · {ic.points.length - 2} controls
        </button>
      {/each}
    </div>
  {/if}
  {#if app.courseError}<p class="note err" role="alert" data-testid="course-error">{app.courseError}</p>{/if}

  {#if c && c.points.length}
    <ol class="points" data-testid="course-points">
      {#each c.points as p, i (p.id)}
        <li class:sel={app.selectedPointId === p.id}>
          <button class="sym {p.kind}" onclick={() => (app.selectedPointId = p.id)} title="Select">
            {pointLabel(c, i)}
          </button>
          {#if p.kind === 'control'}
            <input
              type="text"
              class="code"
              placeholder="code"
              aria-label="Control code for control {pointLabel(c, i)}"
              value={p.code ?? ''}
              onchange={(e) => app.courseUpdate(p.id, { code: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          {:else}
            <span class="kind muted small">{p.kind === 'start' ? 'Start' : 'Finish'}</span>
          {/if}
          <span class="leg mono small muted">{i < legList.length ? formatDistance(legList[i].length) + ' ↓' : ''}</span>
          <span class="acts">
            {#if p.kind === 'control'}
              <button class="btn ghost icon sm" aria-label="Move up" onclick={() => app.courseReorder(p.id, -1)}>
                ↑
              </button>
              <button class="btn ghost icon sm" aria-label="Move down" onclick={() => app.courseReorder(p.id, 1)}>
                ↓
              </button>
            {/if}
            <button
              class="btn ghost icon sm"
              aria-label="Remove {pointLabel(c, i)}"
              onclick={() => app.courseRemove(p.id)}
            >
              ✕
            </button>
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<section class="section">
  <div class="sec-head"><h3 class="sec-title">Course on the map</h3></div>
  <label class="check">
    <input type="checkbox" bind:checked={app.courseStyle.visible} data-testid="course-visible" /> Show course (IOF overprint)
  </label>
  <div class="seg" role="group" aria-label="Symbol size">
    <button aria-pressed={app.courseStyle.sizeMode === 'screen'} onclick={() => (app.courseStyle.sizeMode = 'screen')}>
      Fixed size
    </button>
    <button aria-pressed={app.courseStyle.sizeMode === 'map'} onclick={() => (app.courseStyle.sizeMode = 'map')}>
      Scale with map
    </button>
  </div>
  <label class="field">
    <span>Symbol size · {Math.round(app.courseStyle.sizeFactor * 100)} %</span>
    <input type="range" min="0.6" max="1.8" step="0.05" bind:value={app.courseStyle.sizeFactor} />
  </label>
  <label class="check"><input type="checkbox" bind:checked={app.courseStyle.showNumbers} /> Control numbers</label>
  {#if app.courseStyle.sizeMode === 'map'}
    <small class="muted">
      True print size at the map's print scale{app.raster?.printScale
        ? ` (1:${app.raster.printScale})`
        : ' (set it in the Map tab; 1:10 000 assumed)'}.
    </small>
  {/if}
</section>

<section class="section">
  <div class="sec-head">
    <h3 class="sec-title">Splits</h3>
    {#if ps}<span class="tag">
        {ps.filter((p) => p.status === 'auto' || p.status === 'manual').length}/{ps.length} found
      </span>{/if}
  </div>
  {#if !app.track}
    <p class="small muted">Load a GPX to match it to the course.</p>
  {:else if !ps}
    <p class="small muted">Complete the course (start, controls, finish) to match the GPX to it.</p>
  {:else if c}
    <table class="splits" data-testid="splits">
      <thead><tr><th></th><th>Time</th><th>Leg</th><th>Off</th><th></th></tr></thead>
      <tbody>
        {#each ps as p, i (p.pointId)}
          <tr class:active={app.time >= p.t && (i + 1 >= ps.length || app.time < ps[i + 1].t)}>
            <td>
              <button class="sym {c.points[i].kind}" onclick={() => app.seek(p.t)} title="Go to this passing">
                {pointLabel(c, i)}
              </button>
            </td>
            <td class="mono">{formatDuration(rel(p.t))}</td>
            <td class="mono muted">{i > 0 ? formatDuration(p.t - ps[i - 1].t) : ''}</td>
            <td class="mono muted" title="Distance from the GPX to the control at the passing time">
              {Number.isFinite(p.distance) ? `${Math.round(p.distance)} m` : '–'}
            </td>
            <td class="acts">
              <span class="st {STATUS[p.status].cls}" title={STATUS[p.status].title}>{STATUS[p.status].label}</span>
              <button class="btn ghost icon sm" title="1 s earlier" onclick={() => nudge(p.pointId, p.t - 1)}>−</button>
              <button class="btn ghost icon sm" title="1 s later" onclick={() => nudge(p.pointId, p.t + 1)}>+</button>
              <button class="btn ghost sm" title="Set to the playhead time" onclick={() => nudge(p.pointId, app.time)}>
                now
              </button>
              <button
                class="btn ghost icon sm"
                title="Click the track on the map to set this passing"
                aria-pressed={app.tool === 'pick-passing' && app.pickPassingId === p.pointId}
                onclick={() => {
                  app.setTool('pick-passing');
                  app.pickPassingId = p.pointId;
                }}
              >
                ⌖
              </button>
              {#if app.isManual(p.pointId)}
                <button class="btn ghost icon sm" title="Back to automatic" onclick={() => app.resetPassing(p.pointId)}>
                  ↺
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if app.tool === 'pick-passing'}
      <p class="note warn">Click the track on the map where the runner punched this control.</p>
    {/if}
    <label class="field">
      <span>Search radius around controls · {app.matchRadius} m</span>
      <input type="range" min="15" max="150" step="5" bind:value={app.matchRadius} />
    </label>
    <small class="muted">Drag the control markers on the timeline to fine-tune passing times.</small>
  {/if}
</section>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag.valid {
    color: var(--ok);
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
  .pick {
    display: grid;
    gap: 6px;
  }
  .points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
    max-height: 320px;
    overflow-y: auto;
  }
  .points li {
    display: grid;
    grid-template-columns: 30px 1fr auto auto;
    align-items: center;
    gap: 6px;
    padding: 3px 4px;
    border-radius: 6px;
  }
  .points li.sel {
    background: var(--accent-soft);
  }
  .sym {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #bb29bb;
    background: transparent;
    color: #e07ae0;
    font-weight: 700;
    font-size: 11.5px;
    padding: 0;
  }
  .sym.start {
    border-radius: 3px;
  }
  .sym.finish {
    box-shadow:
      0 0 0 2px var(--bg-elev),
      0 0 0 4px #bb29bb;
  }
  .code {
    height: 26px;
    font-size: 12.5px;
  }
  .acts {
    display: flex;
    align-items: center;
    gap: 1px;
  }
  .splits {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  .splits th {
    text-align: left;
    font-weight: 500;
    color: var(--text-muted);
    font-size: 11.5px;
    padding: 2px 4px;
  }
  .splits td {
    padding: 2px 4px;
    border-top: 1px solid var(--border);
  }
  .splits tr.active td {
    background: var(--accent-soft);
  }
  .splits .sym {
    width: 24px;
    height: 24px;
  }
  .st {
    width: 18px;
    text-align: center;
    font-weight: 700;
  }
  .st.ok {
    color: var(--ok);
  }
  .st.manual {
    color: var(--warn);
  }
  .st.warn {
    color: var(--warn);
  }
  .st.bad {
    color: var(--danger);
  }
</style>
