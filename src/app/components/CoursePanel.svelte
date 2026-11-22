<script lang="ts">
  import { dist, t } from '../i18n.svelte';
  /** Course tab (EPIC-3): course editor (STORY-18), overprint style (STORY-19), IOF XML (STORY-20), splits (STORY-22/23). */
  import { app } from '../state.svelte';
  import { courseLength, courseProblems, legs, pointLabel } from '../../lib/course/course';
  import { writeIofCourseData } from '../../lib/course/iofxml';
  import { isResultListXml } from '../../lib/results/results';
  import { formatDuration } from '../../lib/format';
  import type { PassingStatus } from '../../lib/course/match';

  const c = $derived(app.course);
  const problems = $derived(courseProblems(c));
  const legList = $derived(c ? legs(c) : []);
  const ps = $derived(app.passings);
  const editing = $derived(app.tool === 'course');

  const STATUS: Record<PassingStatus, { label: string; cls: string }> = {
    auto: { label: '●', cls: 'ok' },
    manual: { label: '✎', cls: 'manual' },
    'not-found': { label: '?', cls: 'bad' },
    'start-of-track': { label: '⇤', cls: 'warn' },
    'end-of-track': { label: '⇥', cls: 'warn' },
  };

  function importXml(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f)
      f.text().then((text) => (isResultListXml(text) ? app.importResultsXml(text, f.name) : app.importCourseXml(text)));
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
    <h3 class="sec-title">{t('course.title')}</h3>
    {#if c}
      <span class="tag" class:valid={!problems.length} data-testid="course-status">
        {problems.length
          ? t('course.incomplete')
          : t('course.legs', { n: legList.length, dist: dist(courseLength(c)) })}
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
    {editing ? t('course.doneEditing') : c ? t('course.edit') : t('course.draw')}
  </button>
  {#if editing}
    <ul class="help small muted">
      <li>{@html t('course.help1')}</li>
      <li>{@html t('course.help2')}</li>
      <li>{t('course.help3')}</li>
      <li>{@html t('course.help4')}</li>
    </ul>
  {/if}
  {#if problems.length && c}<p class="note warn">{t(problems[0])}</p>{/if}

  <div class="row gap">
    <label class="btn sm">
      {t('course.import')}
      <input
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        onchange={importXml}
        data-testid="course-import"
      />
    </label>
    <button class="btn sm ghost" disabled={!c || !!problems.length} onclick={exportXml}>{t('course.export')}</button>
    {#if c}<button class="btn sm ghost" onclick={() => app.clearCourse()} disabled={app.locked}>
        {t('course.clear')}
      </button>{/if}
  </div>
  {#if app.importedCourses.length}
    <div class="pick" data-testid="course-choices">
      <span class="small muted">{t('course.choose', { n: app.importedCourses.length })}</span>
      {#each app.importedCourses as ic (ic.name)}
        <button class="btn sm" onclick={() => app.useImportedCourse(ic)}>
          {t('course.choice', { name: ic.name, n: ic.points.length - 2 })}
        </button>
      {/each}
    </div>
  {/if}
  {#if app.courseError}<p class="note err" role="alert" data-testid="course-error">{app.courseError}</p>{/if}

  {#if c && c.points.length}
    <ol class="points" data-testid="course-points">
      {#each c.points as p, i (p.id)}
        <li class:sel={app.selectedPointId === p.id}>
          <button class="sym {p.kind}" onclick={() => (app.selectedPointId = p.id)} title={t('course.select')}>
            {pointLabel(c, i)}
          </button>
          {#if p.kind === 'control'}
            <input
              type="text"
              class="code"
              placeholder={t('course.code')}
              aria-label={t('course.codeLabel', { n: pointLabel(c, i) })}
              value={p.code ?? ''}
              onchange={(e) => app.courseUpdate(p.id, { code: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          {:else}
            <span class="kind muted small">{p.kind === 'start' ? t('course.start') : t('course.finish')}</span>
          {/if}
          <span class="leg mono small muted">{i < legList.length ? dist(legList[i].length) + ' ↓' : ''}</span>
          <span class="acts">
            {#if p.kind === 'control'}
              <button class="btn ghost icon sm" aria-label={t('course.up')} onclick={() => app.courseReorder(p.id, -1)}>
                ↑
              </button>
              <button
                class="btn ghost icon sm"
                aria-label={t('course.down')}
                onclick={() => app.courseReorder(p.id, 1)}
              >
                ↓
              </button>
            {/if}
            <button
              class="btn ghost icon sm"
              aria-label={t('course.remove', { name: pointLabel(c, i) })}
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
  <div class="sec-head"><h3 class="sec-title">{t('course.onMap')}</h3></div>
  <label class="check">
    <input type="checkbox" bind:checked={app.courseStyle.visible} data-testid="course-visible" />
    {t('course.show')}
  </label>
  <div class="seg" role="group" aria-label={t('course.symbolSize')}>
    <button aria-pressed={app.courseStyle.sizeMode === 'screen'} onclick={() => (app.courseStyle.sizeMode = 'screen')}>
      {t('course.fixed')}
    </button>
    <button aria-pressed={app.courseStyle.sizeMode === 'map'} onclick={() => (app.courseStyle.sizeMode = 'map')}>
      {t('course.scaleWithMap')}
    </button>
  </div>
  <label class="field">
    <span>{t('course.sizePct', { pct: Math.round(app.courseStyle.sizeFactor * 100) })}</span>
    <input type="range" min="0.6" max="1.8" step="0.05" bind:value={app.courseStyle.sizeFactor} />
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={app.courseStyle.showNumbers} />
    {t('course.numbers')}
  </label>
  {#if app.courseStyle.sizeMode === 'map'}
    <small class="muted">
      {t('course.trueSize', {
        scale: app.raster?.printScale ? ` (1:${app.raster.printScale})` : t('course.trueSizeUnknown'),
      })}
    </small>
  {/if}
</section>

<section class="section">
  <div class="sec-head">
    <h3 class="sec-title">{t('splits.title')}</h3>
    {#if ps}<span class="tag">
        {t('splits.found', {
          n: ps.filter((p) => p.status === 'auto' || p.status === 'manual').length,
          total: ps.length,
        })}
      </span>{/if}
  </div>
  {#if !app.track}
    <p class="small muted">{t('splits.needGpx')}</p>
  {:else if !ps}
    <p class="small muted">{t('splits.needCourse')}</p>
  {:else if c}
    <table class="splits" data-testid="splits">
      <thead>
        <tr><th></th><th>{t('splits.time')}</th><th>{t('splits.leg')}</th><th>{t('splits.off')}</th><th></th></tr>
      </thead>
      <tbody>
        {#each ps as p, i (p.pointId)}
          <tr class:active={app.time >= p.t && (i + 1 >= ps.length || app.time < ps[i + 1].t)}>
            <td>
              <button class="sym {c.points[i].kind}" onclick={() => app.seek(p.t)} title={t('splits.goTo')}>
                {pointLabel(c, i)}
              </button>
            </td>
            <td class="mono">{formatDuration(rel(p.t))}</td>
            <td class="mono muted">{i > 0 ? formatDuration(p.t - ps[i - 1].t) : ''}</td>
            <td class="mono muted" title={t('splits.offTitle')}>
              {Number.isFinite(p.distance) ? `${Math.round(p.distance)} m` : '–'}
            </td>
            <td class="acts">
              <span class="st {STATUS[p.status].cls}" title={t(`pass.${p.status}`)}>{STATUS[p.status].label}</span>
              <button class="btn ghost icon sm" title={t('splits.earlier')} onclick={() => nudge(p.pointId, p.t - 1)}>
                −
              </button>
              <button class="btn ghost icon sm" title={t('splits.later')} onclick={() => nudge(p.pointId, p.t + 1)}>
                +
              </button>
              <button class="btn ghost sm" title={t('splits.nowTitle')} onclick={() => nudge(p.pointId, app.time)}>
                {t('splits.now')}
              </button>
              <button
                class="btn ghost icon sm"
                title={t('splits.pickTitle')}
                aria-pressed={app.tool === 'pick-passing' && app.pickPassingId === p.pointId}
                onclick={() => {
                  app.setTool('pick-passing');
                  app.pickPassingId = p.pointId;
                }}
              >
                ⌖
              </button>
              {#if app.isManual(p.pointId)}
                <button class="btn ghost icon sm" title={t('splits.auto')} onclick={() => app.resetPassing(p.pointId)}>
                  ↺
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if app.tool === 'pick-passing'}
      <p class="note warn">{t('splits.pickHelp')}</p>
    {/if}
    <label class="field">
      <span>{t('splits.radius', { m: app.matchRadius })}</span>
      <input type="range" min="15" max="150" step="5" bind:value={app.matchRadius} />
    </label>
    <small class="muted">{t('splits.dragHelp')}</small>
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
