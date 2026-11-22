<script lang="ts">
  import { dist, i18n, t } from '../i18n.svelte';
  import { decimalSep } from '../../lib/i18n/core';
  /** Route choices per leg (STORY-30) and when they are shown in the video (STORY-31). */
  import { app } from '../state.svelte';
  import { isValidCourse, legLabel } from '../../lib/course/course';
  import { formatRouteLength, ROUTE_COLORS, routeLength, routesForLeg } from '../../lib/course/routes';

  const c = $derived(app.course);
  const valid = $derived(isValidCourse(c));
  const legCount = $derived(c ? Math.max(0, c.points.length - 1) : 0);
  const legRoutes = $derived(c ? routesForLeg(app.routes, c, app.routeLeg) : []);
  const drawing = $derived(app.tool === 'route');
  const orphans = $derived.by(() => {
    void app.routes;
    void app.course;
    return app.orphanRouteCount();
  });
  /** Distance the runner actually ran on the selected leg. */
  const runLeg = $derived.by(() => {
    const ps = app.passings;
    const tr = app.track;
    if (!ps || !tr || !ps[app.routeLeg + 1]) return null;
    return tr.positionAt(ps[app.routeLeg + 1].t).d - tr.positionAt(ps[app.routeLeg].t).d;
  });

  $effect(() => {
    if (app.routeLeg >= legCount && legCount > 0) app.routeLeg = legCount - 1;
  });
</script>

<section class="section" data-testid="route-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('routes.title')}</h3>
    {#if app.routes.length}<span class="tag">{t('routes.count', { n: app.routes.length })}</span>{/if}
  </div>
  {#if !c || legCount === 0}
    <p class="small muted">{t('routes.needCourse')}</p>
  {:else}
    <div class="row">
      <select
        bind:value={app.routeLeg}
        aria-label={t('routes.leg')}
        data-testid="route-leg"
        disabled={drawing && app.routeDraft.length > 0}
      >
        {#each Array.from({ length: legCount }, (_, i) => i) as i (i)}
          <option value={i}>{t('routes.legOption', { label: legLabel(c, i) })}</option>
        {/each}
      </select>
      <button
        class="btn"
        class:primary={drawing}
        aria-pressed={drawing}
        disabled={app.locked}
        data-testid="route-draw"
        onclick={() => app.setTool('route')}
      >
        {drawing ? t('routes.done') : t('routes.draw')}
      </button>
    </div>
    {#if drawing}
      <ul class="help small muted">
        <li>{@html t('routes.help1')}</li>
        <li>{t('routes.help2')}</li>
      </ul>
      <label class="check"><input type="checkbox" bind:checked={app.routeSnap} /> {t('routes.snap')}</label>
    {/if}

    {#if legRoutes.length}
      <ul class="routes" data-testid="route-list">
        {#each legRoutes as r (r.id)}
          <li>
            <select
              class="swatch"
              style:background={r.color}
              aria-label={t('routes.color', { label: r.label })}
              value={r.color}
              onchange={(e) => app.updateRoute(r.id, { color: (e.currentTarget as HTMLSelectElement).value })}
            >
              {#each ROUTE_COLORS as col (col)}<option value={col} style:background={col}>■</option>{/each}
            </select>
            <input
              type="text"
              class="label"
              maxlength="3"
              aria-label={t('routes.label', { label: r.label })}
              value={r.label}
              onchange={(e) =>
                app.updateRoute(r.id, { label: (e.currentTarget as HTMLInputElement).value.trim() || r.label })}
            />
            <span class="mono len" data-testid="route-length">
              {formatRouteLength(routeLength(r), decimalSep(i18n.locale))}
            </span>
            <button
              class="btn ghost icon sm"
              aria-label={t('routes.delete', { label: r.label })}
              onclick={() => app.removeRoute(r.id)}
            >
              ✕
            </button>
          </li>
        {/each}
      </ul>
    {:else if valid}
      <p class="small muted">{t('routes.none')}</p>
    {/if}
    {#if runLeg !== null}
      <p class="small muted">{t('routes.runner', { dist: dist(runLeg) })}</p>
    {/if}
    {#if orphans}
      <p class="note warn">
        {t('routes.orphans', { n: orphans })}
        <button class="btn sm ghost" onclick={() => app.removeOrphanRoutes()}>{t('routes.remove')}</button>
      </p>
    {/if}
  {/if}
</section>

<section class="section">
  <div class="sec-head"><h3 class="sec-title">{t('routes.showTitle')}</h3></div>
  <div class="seg" role="group" aria-label={t('routes.when')}>
    <button aria-pressed={app.routeDisplay.appear === 'settled'} onclick={() => (app.routeDisplay.appear = 'settled')}>
      {t('routes.after')}
    </button>
    <button
      aria-pressed={app.routeDisplay.appear === 'transition'}
      onclick={() => (app.routeDisplay.appear = 'transition')}
    >
      {t('routes.with')}
    </button>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={app.routeDisplay.wholeLeg} />
    {t('routes.wholeLeg')}
  </label>
  {#if !app.routeDisplay.wholeLeg}
    <div class="seg" role="group" aria-label={t('routes.timeBase')}>
      <button
        aria-pressed={app.routeDisplay.timeBase !== 'real'}
        onclick={() => (app.routeDisplay.timeBase = 'video')}
        data-testid="route-time-video"
      >
        {t('routes.videoTime')}
      </button>
      <button
        aria-pressed={app.routeDisplay.timeBase === 'real'}
        onclick={() => (app.routeDisplay.timeBase = 'real')}
        data-testid="route-time-real"
      >
        {t('routes.realTime')}
      </button>
    </div>
    <small class="muted">{t('routes.timeBaseHelp')}</small>
    <label class="field">
      <span>{t('routes.hold', { s: app.routeDisplay.hold.toFixed(1) })}</span>
      <input
        type="range"
        min="1"
        max={app.routeDisplay.timeBase === 'real' ? 120 : 20}
        step="0.5"
        bind:value={app.routeDisplay.hold}
        data-testid="route-hold"
      />
    </label>
    <label class="field">
      <span>{t('routes.fade', { s: app.routeDisplay.fadeOut.toFixed(1) })}</span>
      <input
        type="range"
        min="0"
        max={app.routeDisplay.timeBase === 'real' ? 20 : 4}
        step="0.1"
        bind:value={app.routeDisplay.fadeOut}
      />
    </label>
  {/if}
  <small class="muted">{t('routes.note')}</small>
</section>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  .help {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 2px;
  }
  .routes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .routes li {
    display: grid;
    grid-template-columns: 34px 52px 1fr auto;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 34px;
    height: 26px;
    padding: 0;
    color: transparent;
    border-radius: 6px;
    border: 2px solid var(--border-strong);
  }
  .label {
    height: 26px;
    text-align: center;
    font-weight: 700;
  }
  .len {
    font-size: 12.5px;
  }
</style>
