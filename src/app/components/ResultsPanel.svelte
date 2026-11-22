<script lang="ts">
  import { t } from '../i18n.svelte';
  /**
   * Results (STORY-41): import an IOF XML 2.0/3.0 result list (file, Navisport link/search or URL), pick the
   * class and your own result, sync passing times from the punches, and see the split comparison.
   */
  import { app } from '../state.svelte';
  import { formatClock, formatDuration } from '../../lib/format';
  import { formatDiff } from '../../lib/results/splits';
  import { isOk } from '../../lib/results/results';
  import type { NavisportEvent } from '../../lib/results/navisport';

  const r = $derived(app.results);
  const me = $derived(r && r.runner !== null ? r.cls.competitors[r.runner] : null);
  const rows = $derived(app.splitRows);
  const res = $derived(app.punchResiduals);
  const map = $derived(app.resultMap);

  let url = $state('');
  let query = $state('');
  let filter = $state('');
  let events = $state.raw<NavisportEvent[] | null>(null);
  let pendingClass = $state(0);

  $effect(() => {
    const p = app.pendingResults;
    if (p) pendingClass = app.bestResultClass(p.file);
  });

  /** Matched course controls / result controls. */
  const matched = $derived(r && map ? map.filter((v) => v !== null && v >= 0 && v < r.cls.controls.length).length : 0);
  /** Course point index for each result row (for residuals). */
  const pointOfRow = $derived.by(() => {
    const m = new Map<number, number>();
    map?.forEach((v, k) => v !== null && v >= 0 && m.set(v, k));
    return m;
  });
  const competitors = $derived(
    r
      ? r.cls.competitors
          .map((c, i) => ({ c, i }))
          .filter(
            ({ c }) => !filter.trim() || `${c.name} ${c.club}`.toLowerCase().includes(filter.trim().toLowerCase()),
          )
      : [],
  );

  function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) f.text().then((text) => app.importResultsXml(text, f.name));
  }

  async function search() {
    events = await app.searchNavisport(query);
  }

  function applyPunches() {
    if (Object.keys(app.passingOverrides).length && !confirm(t('res.confirmOverwrite'))) return;
    const n = app.applyPunchTimes();
    app.toast(n ? t('res.applied', { n }) : t('res.nothingApplied'), n ? 'ok' : 'error');
  }

  const status = (s: string) => (s === 'OK' ? '' : ` · ${s}`);
  const tzHours = $derived(r?.tzOffsetMin === null || r?.tzOffsetMin === undefined ? '' : String(r.tzOffsetMin / 60));
</script>

<section class="section" data-testid="results-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('res.title')}</h3>
    {#if r}<span class="tag" title={r.source}>{r.cls.name}</span>{/if}
  </div>

  {#if !r && !app.pendingResults}
    <p class="small muted">{t('res.intro')}</p>
    <label class="btn sm">
      {t('res.importFile')}
      <input
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        disabled={app.locked}
        onchange={pickFile}
        data-testid="results-file"
      />
    </label>
    <form
      class="row"
      onsubmit={(e) => {
        e.preventDefault();
        if (url.trim()) app.importResultsUrl(url);
      }}
    >
      <input
        type="url"
        class="grow"
        placeholder={t('res.urlPlaceholder')}
        aria-label={t('res.url')}
        bind:value={url}
        data-testid="results-url"
      />
      <button class="btn sm" disabled={app.resultsLoading || !url.trim()}>{t('res.fetch')}</button>
    </form>
    <form
      class="row"
      onsubmit={(e) => {
        e.preventDefault();
        search();
      }}
    >
      <input
        type="search"
        class="grow"
        placeholder={t('res.searchPlaceholder')}
        aria-label={t('res.search')}
        bind:value={query}
        data-testid="navisport-query"
      />
      <button class="btn sm" disabled={app.resultsLoading}>{t('res.search')}</button>
    </form>
    <small class="muted">{t('res.searchHelp')}</small>
    {#if events}
      {#if events.length}
        <ul class="events" data-testid="navisport-events">
          {#each events as ev (ev.id)}
            <li>
              <span class="ev">
                <strong>{ev.parent ? `${ev.parent}, ${ev.name}` : ev.name}</strong>
                <span class="small muted">{ev.begin.slice(0, 10)}{ev.organisation ? ` · ${ev.organisation}` : ''}</span>
              </span>
              <button class="btn sm" disabled={app.resultsLoading} onclick={() => app.importResultsUrl(ev.id)}>
                {t('res.use')}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="small muted">{t('res.noEvents')}</p>
      {/if}
    {/if}
    {#if app.resultsLoading}<p class="small muted">{t('res.loading')}</p>{/if}
  {:else if app.pendingResults}
    {@const p = app.pendingResults}
    <p class="small">{t('res.whichClass', { event: p.file.event, n: p.file.classes.length })}</p>
    <div class="row">
      <select class="grow" bind:value={pendingClass} aria-label={t('res.class')} data-testid="results-class">
        {#each p.file.classes as c, i (i)}
          <option value={i}>
            {t('res.classOption', { name: c.name, n: c.competitors.length, k: c.controls.length })}
          </option>
        {/each}
      </select>
      <button class="btn sm primary" onclick={() => app.chooseResultClass(p.file, pendingClass, p.source)}>
        {t('res.use')}
      </button>
      <button class="btn sm ghost" onclick={() => app.removeResults()}>{t('common.cancel')}</button>
    </div>
  {:else if r}
    <div class="row between">
      <span class="small"><strong>{r.event}</strong> · IOF {r.version}</span>
      <button
        class="btn ghost icon sm"
        aria-label={t('res.remove')}
        title={t('res.remove')}
        disabled={app.locked}
        onclick={() => app.removeResults()}
      >
        ✕
      </button>
    </div>
    <label class="field">
      <span>{t('res.runner')}</span>
      <input type="search" placeholder={t('res.filter')} bind:value={filter} aria-label={t('res.filter')} />
      <select
        value={r.runner ?? ''}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value;
          app.setResultRunner(v === '' ? null : +v);
        }}
        data-testid="results-runner"
      >
        <option value="">{t('res.chooseRunner', { n: r.cls.competitors.length })}</option>
        {#each competitors as { c, i } (i)}
          <option value={i}>
            {c.position ? `${c.position}. ` : ''}{c.name}{c.club ? ` (${c.club})` : ''}{c.finish !== null && isOk(c)
              ? ` ${formatDuration(c.finish)}`
              : ''}{status(c.status)}
          </option>
        {/each}
      </select>
    </label>

    {#if me}
      {#if !app.course}
        <p class="note warn">{t('res.noCourse')}</p>
      {:else}
        <p class="small muted" data-testid="results-matched">
          {t('res.matched', { n: matched, total: r.cls.controls.length })}
        </p>
        {#if matched < r.cls.controls.length}<p class="note warn">{t('res.matchHelp')}</p>{/if}
      {/if}

      {#if me.startMs === null}
        <label class="field">
          <span>{t('res.tz')}</span>
          <input
            type="number"
            step="0.25"
            min="-12"
            max="14"
            placeholder={t('res.tzAuto')}
            value={tzHours}
            onchange={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              app.updateResults({ tzOffsetMin: v === '' ? null : Math.round(+v * 60) });
            }}
          />
        </label>
      {/if}
      {#if app.resultStartMs !== null}
        <p class="small muted">{t('res.start', { time: formatClock(app.resultStartMs) })}</p>
      {/if}

      {#if app.course && app.track}
        <label class="field">
          <span>{t('res.clockOffset')}</span>
          <div class="row">
            <input
              type="number"
              step="0.1"
              class="grow"
              value={r.clockOffset}
              onchange={(e) => app.updateResults({ clockOffset: +(e.currentTarget as HTMLInputElement).value || 0 })}
              data-testid="results-offset"
            />
            <span class="muted small">s</span>
            <button class="btn sm ghost" onclick={() => app.autoClockOffset()}>{t('res.auto')}</button>
          </div>
          <small class="muted">{t('res.clockOffsetHelp')}</small>
        </label>
        <button class="btn sm primary" disabled={app.locked} onclick={applyPunches} data-testid="results-apply">
          {t('res.apply')}
        </button>
      {/if}

      <label class="field">
        <span>{t('res.reference')}</span>
        <select
          value={r.reference}
          onchange={(e) =>
            app.updateResults({ reference: (e.currentTarget as HTMLSelectElement).value as 'ok' | 'all' })}
        >
          <option value="ok">{t('res.refOk')}</option>
          <option value="all">{t('res.refAll')}</option>
        </select>
      </label>

      {#if rows}
        <table class="splits small" data-testid="results-splits">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('res.leg')}</th>
              <th></th>
              <th>{t('res.total')}</th>
              <th></th>
              <th title={t('res.residualTitle')}>Δ m</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, i (i)}
              {@const k = pointOfRow.get(i)}
              {@const d = k !== undefined && res ? res[k] : null}
              <tr>
                <td class="mono">{row.finish ? t('res.finish') : `${i + 1}·${row.code}`}</td>
                <td class="mono">{row.leg === null ? '–' : formatDuration(row.leg)}</td>
                <td class="mono" class:lead={row.legDiff !== null && row.legDiff < 0.5}>{formatDiff(row.legDiff)}</td>
                <td class="mono">{row.elapsed === null ? '–' : formatDuration(row.elapsed)}</td>
                <td class="mono" class:lead={row.totalDiff !== null && row.totalDiff < 0.5}>
                  {formatDiff(row.totalDiff)}
                </td>
                <td class="mono" class:bad={d !== null && d > 30}>{d === null ? '' : Math.round(d)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <small class="muted">{t('res.componentHint')}</small>
      {/if}
    {/if}
  {/if}
  {#if app.resultsError}<p class="note err" role="alert" data-testid="results-error">{app.resultsError}</p>{/if}
</section>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .between {
    justify-content: space-between;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    max-height: 240px;
    overflow-y: auto;
  }
  .events li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .ev {
    display: grid;
    min-width: 0;
  }
  .ev strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .splits {
    width: 100%;
    border-collapse: collapse;
  }
  .splits th {
    text-align: left;
    font-weight: 600;
    color: var(--text-muted);
  }
  .splits td,
  .splits th {
    padding: 2px 4px;
  }
  .splits tbody tr:nth-child(odd) {
    background: var(--bg-input);
  }
  .lead {
    color: var(--ok);
  }
  .bad {
    color: var(--danger);
  }
</style>
