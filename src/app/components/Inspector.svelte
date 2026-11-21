<script lang="ts">
  import { t } from '../i18n.svelte';
  /** Right-hand inspector: the panel of the selected workflow step (WorkflowRail, STORY-37). */
  import { app, ASPECTS } from '../state.svelte';
  import AnimationPanel from './AnimationPanel.svelte';
  import ComponentsPanel from './ComponentsPanel.svelte';
  import CoursePanel from './CoursePanel.svelte';
  import ExportPanel from './ExportPanel.svelte';
  import GpxPanel from './GpxPanel.svelte';
  import MapPanel from './MapPanel.svelte';
  import PresetsPanel from './PresetsPanel.svelte';
  import RoutePanel from './RoutePanel.svelte';
</script>

<aside class="inspector" aria-label={t('insp.label')}>
  {#if app.inspectorTab === 'map'}
    <MapPanel />
  {:else if app.inspectorTab === 'course'}
    <CoursePanel />
  {:else if app.inspectorTab === 'gpx'}
    <GpxPanel />
  {:else if app.inspectorTab === 'routes'}
    <RoutePanel />
  {:else if app.inspectorTab === 'export'}
    <ComponentsPanel />
    <ExportPanel />
  {:else}
    <PresetsPanel />
    <AnimationPanel />

    <section>
      <header><h3>{t('frame.title')}</h3></header>
      <div class="seg" role="group" aria-label={t('frame.aspect')}>
        {#each ASPECTS as a (a.label)}
          <button
            aria-pressed={Math.abs(app.aspect - a.value) < 1e-6}
            disabled={app.locked}
            onclick={() => app.setAspect(a.value)}
          >
            {a.label}
          </button>
        {/each}
        <button aria-pressed={!!app.frameCustom} disabled title={t('frame.freeTitle')}>{t('frame.free')}</button>
      </div>
      <div class="size">
        <input
          type="number"
          aria-label={t('frame.width')}
          data-testid="frame-width"
          min="160"
          value={app.frame.width}
          disabled={app.locked}
          onchange={(e) => app.setFrameSize(+(e.currentTarget as HTMLInputElement).value, app.frame.height)}
        />
        <span class="muted">×</span>
        <input
          type="number"
          aria-label={t('frame.height')}
          data-testid="frame-height"
          min="90"
          value={app.frame.height}
          disabled={app.locked}
          onchange={(e) => app.setFrameSize(app.frame.width, +(e.currentTarget as HTMLInputElement).value)}
        />
        <span class="muted mono small">{(app.frame.width / Math.max(1, app.frame.height)).toFixed(3)}:1</span>
      </div>
      <small class="muted">
        {t('frame.help')}
      </small>
    </section>

    <section>
      <header><h3>{t('overlays.title')}</h3></header>
      <label class="check">
        <input type="checkbox" bind:checked={app.style.showNorthArrow} disabled={app.locked} />
        {t('overlays.north')}
      </label>
      <small class="muted">{t('overlays.help')}</small>
    </section>
  {/if}
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
  .size {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    align-items: center;
    gap: 6px;
  }
  small {
    font-size: 11.5px;
  }
</style>
