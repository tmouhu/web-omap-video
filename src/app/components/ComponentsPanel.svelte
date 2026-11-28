<script lang="ts">
  import { secs, t } from '../i18n.svelte';
  import { LOCALES } from '../../lib/i18n/core';
  /** Data component videos (STORY-32..34): enable, size, style, kind options, live preview at the playhead. */
  import { app } from '../state.svelte';
  import { COMPONENT_META, drawComponent, isAvailable, type ComponentConfig } from '../../lib/components/components';

  const canvases: Record<string, HTMLCanvasElement> = {};
  /** Slider range factor: real seconds at a high speed (STORY-47). */
  const rk = $derived(app.timeBase === 'real' ? Math.max(1, app.speed) : 1);

  // Live previews: redraw when the playhead, data or any component setting changes.
  $effect(() => {
    const track = app.track;
    const r = app.range;
    const t = app.time;
    const passings = app.passings?.map((p) => p.t) ?? null;
    void app.videoLocale;
    const splits = app.splitEvents;
    const timeScale = app.timeScale;
    const cfgs = $state.snapshot(app.components) as ComponentConfig[];
    if (!track || !r) return;
    for (const cfg of cfgs) {
      const c = canvases[cfg.kind];
      if (!c || !cfg.enabled || !isAvailable(cfg.kind, track, !!splits?.length)) continue;
      c.width = cfg.width;
      c.height = cfg.height;
      drawComponent(c.getContext('2d')!, cfg, {
        track,
        t,
        rangeStart: r.start,
        rangeEnd: r.end,
        origin: r.origin,
        passings,
        locale: app.videoLocale,
        timeScale,
        splits,
      });
    }
  });

  function setZones(c: ComponentConfig, text: string) {
    const z = text
      .split(/[,\s]+/)
      .map(Number)
      .filter((v) => Number.isFinite(v) && v > 30 && v < 250)
      .sort((a, b) => a - b);
    if (z.length) c.options.hrZones = z;
  }
</script>

<section class="section" data-testid="components-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('dv.title')}</h3>
    <span class="tag">{t('dv.on', { n: app.components.filter((c) => c.enabled).length })}</span>
  </div>
  <p class="small muted">{t('dv.intro')}</p>
  <label class="field">
    <span>{t('dv.videoLang')}</span>
    <select bind:value={app.videoLocale} disabled={app.locked} data-testid="video-language">
      {#each LOCALES as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
    </select>
  </label>
  {#each app.components as c (c.kind)}
    {@const available = isAvailable(c.kind, app.track, !!app.splitEvents?.length)}
    <div class="comp" class:on={c.enabled && available}>
      <label class="check head">
        <input
          type="checkbox"
          bind:checked={c.enabled}
          disabled={!available || app.locked}
          data-testid="comp-{c.kind}"
        />
        <span class="name">{t(`comp.${c.kind}`)}</span>
        {#if !available}
          <span class="muted small">
            {app.track
              ? COMPONENT_META[c.kind].needs === 'heartRate'
                ? t('dv.noHr')
                : COMPONENT_META[c.kind].needs === 'results'
                  ? t('dv.noResults')
                  : t('dv.noEle')
              : ''}
          </span>
        {/if}
      </label>
      {#if c.enabled && available}
        <canvas class="preview" bind:this={canvases[c.kind]} data-testid="comp-preview-{c.kind}"></canvas>
        <details>
          <summary class="small muted">{t('dv.sizeStyle')}</summary>
          <div class="opts">
            <div class="size">
              <input
                type="number"
                min="80"
                max="3840"
                bind:value={c.width}
                aria-label={t('dv.width')}
                disabled={app.locked}
              />
              <span class="muted">×</span>
              <input
                type="number"
                min="40"
                max="2160"
                bind:value={c.height}
                aria-label={t('dv.height')}
                disabled={app.locked}
              />
              <span class="muted small">px</span>
            </div>
            <div class="colors">
              <label>
                <span class="small muted">{t('dv.background')}</span><input
                  type="color"
                  bind:value={c.style.background}
                />
              </label>
              <label>
                <span class="small muted">{t('dv.text')}</span><input type="color" bind:value={c.style.text} />
              </label>
              <label>
                <span class="small muted">{t('dv.accent')}</span><input type="color" bind:value={c.style.accent} />
              </label>
            </div>
            <label class="check"><input type="checkbox" bind:checked={c.style.showLabel} /> {t('dv.label')}</label>
            {#if c.kind !== 'elevation'}
              <label class="check"><input type="checkbox" bind:checked={c.style.showIcon} /> {t('dv.icon')}</label>
            {/if}
            {#if c.kind === 'elevation'}
              <div class="seg" role="group" aria-label={t('dv.xAxis')}>
                <button aria-pressed={c.options.xAxis === 'distance'} onclick={() => (c.options.xAxis = 'distance')}>
                  {t('dv.byDistance')}
                </button>
                <button aria-pressed={c.options.xAxis === 'time'} onclick={() => (c.options.xAxis = 'time')}>
                  {t('dv.byTime')}
                </button>
              </div>
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showControls} />
                {t('dv.controlMarks')}
              </label>
            {:else if c.kind === 'pace'}
              <label class="field">
                <span>{t('dv.smoothing', { s: c.options.paceWindow })}</span>
                <input type="range" min="3" max="30" step="1" bind:value={c.options.paceWindow} />
              </label>
            {:else if c.kind === 'heartRate'}
              <label class="field">
                <span>{t('dv.zones')}</span>
                <input
                  type="text"
                  value={c.options.hrZones.join(', ')}
                  onchange={(e) => setZones(c, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {:else if c.kind === 'time'}
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showControls} />
                {t('dv.legTime')}
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  checked={c.options.beforeStart === 'countdown'}
                  onchange={(e) =>
                    (c.options.beforeStart = (e.currentTarget as HTMLInputElement).checked ? 'countdown' : 'zero')}
                />
                {t('dv.countdown')}
              </label>
            {:else if c.kind === 'splits'}
              <label class="field">
                <span>{t('dv.splitShow', { s: secs(c.options.splitShow, app.timeBase) })}</span>
                <input type="range" min="1" max={20 * rk} step={0.5 * rk} bind:value={c.options.splitShow} />
              </label>
              <label class="field">
                <span>{t('dv.splitShowFinish', { s: secs(c.options.splitShowFinish, app.timeBase) })}</span>
                <input type="range" min="1" max={30 * rk} step={0.5 * rk} bind:value={c.options.splitShowFinish} />
              </label>
              <label class="field">
                <span>{t('dv.fadeIn', { s: secs(c.options.splitFadeIn, app.timeBase) })}</span>
                <input type="range" min="0" max={2 * rk} step={0.1 * rk} bind:value={c.options.splitFadeIn} />
              </label>
              <label class="field">
                <span>{t('dv.fadeOut', { s: secs(c.options.splitFadeOut, app.timeBase) })}</span>
                <input type="range" min="0" max={3 * rk} step={0.1 * rk} bind:value={c.options.splitFadeOut} />
              </label>
              <label class="field">
                <span>{t('dv.keyColor')}</span>
                <input type="color" bind:value={c.options.keyColor} data-testid="splits-key-color" />
                <small class="muted">{t('dv.keyColorHelp')}</small>
              </label>
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showRank} />
                {t('dv.showRank')}
              </label>
            {:else if c.kind === 'distance'}
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showControls} />
                {t('dv.legDistance')}
              </label>
            {/if}
          </div>
        </details>
      {/if}
    </div>
  {/each}
</section>

<style>
  .comp {
    display: grid;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .comp.on {
    border-color: var(--border-strong);
    background: var(--bg-input);
  }
  .head {
    gap: 8px;
  }
  .name {
    font-weight: 600;
  }
  .preview {
    width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  details summary {
    cursor: pointer;
  }
  .opts {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }
  .size {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    align-items: center;
    gap: 6px;
  }
  .colors {
    display: flex;
    gap: 12px;
  }
  .colors label {
    display: grid;
    gap: 2px;
  }
  input[type='color'] {
    width: 44px;
    height: 26px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: none;
    padding: 0;
  }
</style>
