<script lang="ts">
  import { t } from '../i18n.svelte';
  /**
   * Map panel (EPIC-2): orienteering raster map (STORY-13), manual georeferencing (STORY-14),
   * layer stack (STORY-16), custom WMS/WMTS (STORY-17), credits for the video description.
   */
  import { app } from '../state.svelte';
  import { crsName } from '../../lib/geo/crs';
  import { isReprojected, sourceCrs, type LayerDesc } from '../../lib/map/layerModel';
  import { pixelSize } from '../../lib/raster/affine';
  import { viewAffine } from '../../lib/raster/rasterMap';
  import { formatWorldFile } from '../../lib/raster/worldfile';
  import { RASTER_ACCEPT, WORLD_FILE_ACCEPT } from '../../lib/raster/load';
  import AddLayerDialog from './AddLayerDialog.svelte';

  let addOpen = $state(false);
  let copied = $state(false);
  let pendingCrs = $state('EPSG:3067');

  /** Built-in layers get translated titles; user layers keep their own. */
  const layerTitle = (l: LayerDesc) =>
    l.kind === 'mapant' ? t('layer.mapant') : l.kind === 'osm' ? t('layer.osm') : l.title;

  const r = $derived(app.raster);
  const rasterDesc = $derived(app.layers.find((l) => l.kind === 'raster'));
  const pxSize = $derived(r ? pixelSize(viewAffine(r, app.crs.code)) : 0);
  /** Print scale if the image was scanned at 300 dpi (rough hint). */
  const scaleAt300 = $derived(pxSize ? Math.round(pxSize / (0.0254 / 300) / 500) * 500 : 0);
  const fit = $derived(app.georefFit);
  const layersTopFirst = $derived([...app.layers].reverse());

  function pickFiles(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) app.addRasterFiles(files);
  }

  function pickWorldFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) app.applyWorldFile(files);
  }

  function downloadWorldFile() {
    if (!r) return;
    const blob = new Blob([formatWorldFile(r.georef.affine)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${r.name}.wld`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function copyCredits() {
    await navigator.clipboard.writeText(app.credits);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  const m = (v: number) => (v >= 100 ? `${v.toFixed(0)} m` : `${v.toFixed(1)} m`);
</script>

{#snippet crsSelect()}
  <select bind:value={pendingCrs} aria-label={t('map.crsOfWorldFile')} data-testid="world-crs">
    <option value="EPSG:3067">{t('map.tm35')}</option>
    <option value="EPSG:3857">Web Mercator</option>
    <option value="EPSG:4326">{t('map.wgs84')}</option>
    {#each Array.from({ length: 60 }, (_, i) => i + 1) as z (z)}
      <option value={`UTM${z}`}>{t('map.utmZone', { z })}</option>
    {/each}
  </select>
{/snippet}

<section class="section" data-testid="map-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('map.title')}</h3>
    <span class="tag mono" title={t('map.crsTitle')} data-testid="crs-tag">
      {app.crs.name}
    </span>
  </div>

  <!-- Orienteering map image -->
  {#if r}
    <div class="raster" data-testid="raster-info">
      <div class="row">
        <strong class="name" title={r.name}>{r.name}</strong>
        <button
          class="btn ghost icon sm"
          title={t('map.removeImage')}
          aria-label={t('map.removeImage')}
          disabled={app.locked}
          onclick={() => app.removeRaster()}
        >
          ✕
        </button>
      </div>
      <dl>
        <dt>{t('map.image')}</dt>
        <dd class="mono">{r.width} × {r.height} px</dd>
        <dt>{t('map.placement')}</dt>
        <dd data-testid="georef-source">{t(`src.${r.georef.source}`)}</dd>
        <dt>{t('map.coordinates')}</dt>
        <dd>{crsName(r.georef.crs)}</dd>
        <dt>{t('map.pixelSize')}</dt>
        <dd class="mono">{pxSize.toFixed(3)} m</dd>
      </dl>
      <label class="field">
        <span>{t('map.printScale')}</span>
        <div class="scale">
          <span class="mono muted">1:</span>
          <input
            type="number"
            min="500"
            step="500"
            placeholder={scaleAt300 ? t('map.at300', { scale: scaleAt300 }) : '10000'}
            value={r.printScale ?? ''}
            disabled={app.locked}
            onchange={(e) => {
              const v = +(e.currentTarget as HTMLInputElement).value;
              app.setPrintScale(v > 0 ? v : null);
            }}
          />
        </div>
      </label>
      {#if rasterDesc}
        <label class="field">
          <span>{t('map.opacity', { pct: Math.round(rasterDesc.opacity * 100) })}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={rasterDesc.opacity}
            data-testid="raster-opacity"
          />
          <small class="muted">{t('map.opacityHelp')}</small>
        </label>
      {/if}
      {#if !app.georef.active}
        <div class="row gap">
          <button class="btn sm" onclick={() => app.startGeoref()} disabled={app.locked} data-testid="georef-start">
            {r.georef.source === 'placed' ? t('map.georef') : t('map.adjust')}
          </button>
          <label class="btn sm ghost" title={t('map.loadWorldFileTitle')}>
            {t('map.loadWorldFile')}
            <input
              type="file"
              multiple
              hidden
              accept={WORLD_FILE_ACCEPT}
              disabled={app.locked}
              data-testid="world-file-input"
              onchange={pickWorldFile}
            />
          </label>
          <button class="btn sm ghost" onclick={downloadWorldFile} title={t('map.worldFileTitle')}>
            {t('map.worldFile')}
          </button>
        </div>
      {/if}
      {#if app.pendingWorldFile}
        <p class="note warn">{t('map.whichCrs')}</p>
        <div class="row gap">
          {@render crsSelect()}
          <button class="btn sm primary" onclick={() => app.resolvePendingWorldFile(pendingCrs)}>{t('map.use')}</button>
        </div>
      {/if}
    </div>
  {:else if app.pendingRaster}
    <div class="raster">
      <p class="note warn">
        {t('map.whichCrs')}
      </p>
      <div class="row gap">
        {@render crsSelect()}
        <button class="btn sm primary" onclick={() => app.resolvePendingRaster(pendingCrs)}>{t('map.use')}</button>
      </div>
    </div>
  {:else}
    <label class="drop">
      <input
        type="file"
        multiple
        hidden
        data-testid="raster-input"
        disabled={app.locked || app.rasterLoading}
        accept={RASTER_ACCEPT}
        onchange={pickFiles}
      />
      <strong>{app.rasterLoading ? t('map.loading') : t('map.add')}</strong>
      <span class="muted small">{t('map.addHelp')}</span>
    </label>
  {/if}
  {#if app.rasterError}<p class="note err" role="alert" data-testid="raster-error">{app.rasterError}</p>{/if}

  <!-- Georeferencing session -->
  {#if app.georef.active && r}
    <div class="georef" data-testid="georef-panel">
      <div class="row">
        <strong>{t('geo.title')}</strong>
        <span class="tag">{fit ? t(`geo.kind.${fit.kind}`) : t('geo.noPoints')}</span>
      </div>
      <ol class="steps muted small">
        <li>{t('geo.step1')}</li>
        <li>{t('geo.step2')}</li>
      </ol>
      <small class="muted">{t('geo.help')}</small>
      {#if app.georef.pairs.length}
        <ul class="pairs" data-testid="georef-pairs">
          {#each app.georef.pairs as _, i (i)}
            <li>
              <span class="num">{i + 1}</span>
              <span class="mono small">{fit && app.georef.pairs.length > 2 ? m(fit.residuals[i]) : '—'}</span>
              <button
                class="btn ghost icon sm"
                aria-label={t('geo.removePoint', { n: i + 1 })}
                onclick={() => app.removeGeorefPair(i)}
              >
                ✕
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if fit && app.georef.pairs.length > 2}
        <p class="note" class:warn={fit.rms > 5} class:ok={fit.rms <= 5} data-testid="georef-rms">
          {t('geo.rms', { value: m(fit.rms) })}
          {fit.rms > 5 ? t('geo.check') : ''}
        </p>
      {/if}
      {#if app.georef.pairs.length >= 3}
        <label class="check">
          <input
            type="checkbox"
            checked={app.georef.prefer === 'similarity'}
            onchange={(e) => app.setGeorefPrefer((e.currentTarget as HTMLInputElement).checked ? 'similarity' : 'auto')}
          />
          {t('geo.keepShape')}
        </label>
      {/if}
      <div class="row gap">
        <button class="btn sm primary" onclick={() => app.finishGeoref()} data-testid="georef-done">
          {t('common.done')}
        </button>
        <button class="btn sm" onclick={() => app.cancelGeoref()}>{t('common.cancel')}</button>
      </div>
    </div>
  {/if}

  <!-- Layer stack -->
  <div class="layers">
    <div class="row">
      <span class="small muted">{t('layers.title')}</span>
      <button class="btn sm" onclick={() => (addOpen = true)} disabled={app.locked} data-testid="add-layer">
        {t('layers.add')}
      </button>
    </div>
    <ul data-testid="layer-list">
      {#each layersTopFirst as l, i (l.id)}
        <li class:off={!l.visible}>
          <input
            type="checkbox"
            bind:checked={l.visible}
            aria-label={t('layers.show', { name: layerTitle(l) })}
            disabled={app.locked}
            data-testid="layer-visible-{l.id}"
          />
          <div class="lmain">
            <span class="ltitle" title={layerTitle(l)}>{layerTitle(l)}</span>
            <span class="badges">
              {#if l.kind === 'raster'}<span class="badge">{t('layers.orienteering')}</span>{/if}
              {#if l.visible && (app.layerHealth[l.id]?.error ?? 0) >= 6 && (app.layerHealth[l.id]?.ok ?? 0) === 0}
                <span class="badge warn" data-testid="layer-failing-{l.id}" title={t('layers.failingTitle')}>
                  {t('layers.failing')}
                </span>
              {/if}
              {#if isReprojected(l, app.crs.code)}
                <span
                  class="badge"
                  title={t('layers.reprojTitle', { from: sourceCrs(l, app.crs.code), to: app.crs.name })}
                >
                  {t('layers.reprojected')}
                </span>
              {/if}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={l.opacity}
              aria-label={t('layers.opacity', { name: layerTitle(l) })}
              disabled={app.locked}
            />
          </div>
          <div class="lbtns">
            <button
              class="btn ghost icon sm"
              aria-label={t('layers.up', { name: layerTitle(l) })}
              disabled={i === 0 || app.locked}
              onclick={() => app.moveLayer(l.id, 1)}
            >
              ↑
            </button>
            <button
              class="btn ghost icon sm"
              aria-label={t('layers.down', { name: layerTitle(l) })}
              disabled={i === layersTopFirst.length - 1 || app.locked}
              onclick={() => app.moveLayer(l.id, -1)}
            >
              ↓
            </button>
            {#if l.kind !== 'mapant' && l.kind !== 'osm'}
              <button
                class="btn ghost icon sm"
                aria-label={t('layers.remove', { name: layerTitle(l) })}
                disabled={app.locked}
                onclick={() => app.removeLayer(l.id)}
              >
                ✕
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <!-- Credits (not drawn in the video) -->
  <div class="credits">
    <div class="row">
      <span class="small muted">{t('credits.title')}</span>
      <button class="btn sm ghost" onclick={copyCredits} disabled={!app.credits}>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
    <p class="small" data-testid="credits">{app.credits || '—'}</p>
    <small class="muted">{t('credits.help')}</small>
  </div>
</section>

{#if addOpen}<AddLayerDialog onclose={() => (addOpen = false)} />{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .row.gap {
    justify-content: flex-start;
    /* Button rows wrap instead of widening the inspector (long Finnish labels). */
    flex-wrap: wrap;
  }
  .row.gap select {
    flex: 1;
    min-width: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .raster,
  .georef,
  .layers,
  .credits {
    display: grid;
    gap: 10px;
  }
  /* Grid items may shrink below their content width, so nothing forces horizontal scrolling. */
  .raster > *,
  .georef > *,
  .layers > *,
  .credits > * {
    min-width: 0;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    margin: 0;
    font-size: 12.5px;
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
    text-align: right;
  }
  .scale {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 6px;
  }
  .drop {
    display: grid;
    gap: 4px;
    padding: 14px;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s;
  }
  .drop:hover {
    border-color: var(--accent);
  }
  .georef {
    padding: 12px;
    border-radius: var(--radius);
    background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .steps {
    margin: 0;
    padding-left: 18px;
  }
  .pairs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .pairs li {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    gap: 6px;
  }
  .num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    color: #1a0d05;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
  }
  .layers ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .layers li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 8px 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input);
  }
  .layers li.off .lmain {
    opacity: 0.5;
  }
  .lmain {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .ltitle {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badges {
    display: flex;
    gap: 4px;
  }
  .badge {
    font-size: 10.5px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
  }
  .badge.warn {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 50%, transparent);
  }
  .lbtns {
    display: flex;
    gap: 2px;
  }
  .lmain input[type='range'] {
    height: 16px;
  }
  .credits p {
    margin: 0;
    color: var(--text-muted);
  }
</style>
