<script lang="ts">
  /** Route choices per leg (STORY-30) and when they are shown in the video (STORY-31). */
  import { app } from '../state.svelte';
  import { isValidCourse, legLabel } from '../../lib/course/course';
  import { formatRouteLength, ROUTE_COLORS, routeLength, routesForLeg } from '../../lib/course/routes';
  import { formatDistance } from '../../lib/format';

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
    <h3 class="sec-title">Route choices</h3>
    {#if app.routes.length}<span class="tag">{app.routes.length} routes</span>{/if}
  </div>
  {#if !c || legCount === 0}
    <p class="small muted">Set the course first; route choices are drawn per leg.</p>
  {:else}
    <div class="row">
      <select
        bind:value={app.routeLeg}
        aria-label="Leg"
        data-testid="route-leg"
        disabled={drawing && app.routeDraft.length > 0}
      >
        {#each Array.from({ length: legCount }, (_, i) => i) as i (i)}
          <option value={i}>Leg {legLabel(c, i)}</option>
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
        {drawing ? 'Done' : 'Draw routes'}
      </button>
    </div>
    {#if drawing}
      <ul class="help small muted">
        <li>Click along the route; <b>double-click</b> or <kbd>Enter</kbd> finishes it. <kbd>Esc</kbd> cancels.</li>
        <li>Drag the white dots to adjust a route.</li>
      </ul>
      <label class="check"><input type="checkbox" bind:checked={app.routeSnap} /> Start and end at the controls</label>
    {/if}

    {#if legRoutes.length}
      <ul class="routes" data-testid="route-list">
        {#each legRoutes as r (r.id)}
          <li>
            <select
              class="swatch"
              style:background={r.color}
              aria-label="Colour of route {r.label}"
              value={r.color}
              onchange={(e) => app.updateRoute(r.id, { color: (e.currentTarget as HTMLSelectElement).value })}
            >
              {#each ROUTE_COLORS as col (col)}<option value={col} style:background={col}>■</option>{/each}
            </select>
            <input
              type="text"
              class="label"
              maxlength="3"
              aria-label="Label of route {r.label}"
              value={r.label}
              onchange={(e) =>
                app.updateRoute(r.id, { label: (e.currentTarget as HTMLInputElement).value.trim() || r.label })}
            />
            <span class="mono len" data-testid="route-length">{formatRouteLength(routeLength(r))}</span>
            <button class="btn ghost icon sm" aria-label="Delete route {r.label}" onclick={() => app.removeRoute(r.id)}>
              ✕
            </button>
          </li>
        {/each}
      </ul>
    {:else if valid}
      <p class="small muted">No routes for this leg yet.</p>
    {/if}
    {#if runLeg !== null}
      <p class="small muted">Runner's distance on this leg: <span class="mono">{formatDistance(runLeg)}</span></p>
    {/if}
    {#if orphans}
      <p class="note warn">
        {orphans} route{orphans > 1 ? 's belong' : ' belongs'} to legs that no longer exist.
        <button class="btn sm ghost" onclick={() => app.removeOrphanRoutes()}>Remove</button>
      </p>
    {/if}
  {/if}
</section>

<section class="section">
  <div class="sec-head"><h3 class="sec-title">Showing routes in the video</h3></div>
  <div class="seg" role="group" aria-label="When routes appear">
    <button aria-pressed={app.routeDisplay.appear === 'settled'} onclick={() => (app.routeDisplay.appear = 'settled')}>
      After the turn
    </button>
    <button
      aria-pressed={app.routeDisplay.appear === 'transition'}
      onclick={() => (app.routeDisplay.appear = 'transition')}
    >
      With the turn
    </button>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={app.routeDisplay.wholeLeg} /> Keep visible for the whole leg
  </label>
  {#if !app.routeDisplay.wholeLeg}
    <label class="field">
      <span>Visible for · {app.routeDisplay.hold.toFixed(1)} s</span>
      <input type="range" min="1" max="20" step="0.5" bind:value={app.routeDisplay.hold} data-testid="route-hold" />
    </label>
    <label class="field">
      <span>Fade out · {app.routeDisplay.fadeOut.toFixed(1)} s</span>
      <input type="range" min="0" max="4" step="0.1" bind:value={app.routeDisplay.fadeOut} />
    </label>
  {/if}
  <small class="muted">Times are video seconds. Routes are shown only with the leg-by-leg camera.</small>
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
  kbd {
    font-family: var(--mono);
    font-size: 11px;
    padding: 0 4px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
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
