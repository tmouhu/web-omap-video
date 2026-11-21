<script lang="ts">
  /** Data component videos (STORY-32..34): enable, size, style, kind options, live preview at the playhead. */
  import { app } from '../state.svelte';
  import { COMPONENT_META, drawComponent, isAvailable, type ComponentConfig } from '../../lib/components/components';

  const canvases: Record<string, HTMLCanvasElement> = {};

  // Live previews: redraw when the playhead, data or any component setting changes.
  $effect(() => {
    const track = app.track;
    const r = app.range;
    const t = app.time;
    const passings = app.passings?.map((p) => p.t) ?? null;
    const cfgs = $state.snapshot(app.components) as ComponentConfig[];
    if (!track || !r) return;
    for (const cfg of cfgs) {
      const c = canvases[cfg.kind];
      if (!c || !cfg.enabled || !isAvailable(cfg.kind, track)) continue;
      c.width = cfg.width;
      c.height = cfg.height;
      drawComponent(c.getContext('2d')!, cfg, {
        track,
        t,
        rangeStart: r.start,
        rangeEnd: r.end,
        origin: r.origin,
        passings,
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
    <h3 class="sec-title">Data videos</h3>
    <span class="tag">{app.components.filter((c) => c.enabled).length} on</span>
  </div>
  <p class="small muted">
    Separate videos exported together with the map, frame by frame in sync. Place them over your head cam footage in
    your editor.
  </p>
  {#each app.components as c (c.kind)}
    {@const available = isAvailable(c.kind, app.track)}
    <div class="comp" class:on={c.enabled && available}>
      <label class="check head">
        <input
          type="checkbox"
          bind:checked={c.enabled}
          disabled={!available || app.locked}
          data-testid="comp-{c.kind}"
        />
        <span class="name">{COMPONENT_META[c.kind].label}</span>
        {#if !available}
          <span class="muted small">
            {app.track
              ? `no ${COMPONENT_META[c.kind].needs === 'heartRate' ? 'heart rate' : 'elevation'} in the GPX`
              : ''}
          </span>
        {/if}
      </label>
      {#if c.enabled && available}
        <canvas class="preview" bind:this={canvases[c.kind]} data-testid="comp-preview-{c.kind}"></canvas>
        <details>
          <summary class="small muted">Size and style</summary>
          <div class="opts">
            <div class="size">
              <input type="number" min="80" max="3840" bind:value={c.width} aria-label="Width" disabled={app.locked} />
              <span class="muted">×</span>
              <input
                type="number"
                min="40"
                max="2160"
                bind:value={c.height}
                aria-label="Height"
                disabled={app.locked}
              />
              <span class="muted small">px</span>
            </div>
            <div class="colors">
              <label>
                <span class="small muted">Background</span><input type="color" bind:value={c.style.background} />
              </label>
              <label><span class="small muted">Text</span><input type="color" bind:value={c.style.text} /></label>
              <label><span class="small muted">Accent</span><input type="color" bind:value={c.style.accent} /></label>
            </div>
            <label class="check"><input type="checkbox" bind:checked={c.style.showLabel} /> Label</label>
            {#if c.kind !== 'elevation'}
              <label class="check"><input type="checkbox" bind:checked={c.style.showIcon} /> Icon</label>
            {/if}
            {#if c.kind === 'elevation'}
              <div class="seg" role="group" aria-label="X axis">
                <button aria-pressed={c.options.xAxis === 'distance'} onclick={() => (c.options.xAxis = 'distance')}>
                  By distance
                </button>
                <button aria-pressed={c.options.xAxis === 'time'} onclick={() => (c.options.xAxis = 'time')}>
                  By time
                </button>
              </div>
              <label class="check"><input type="checkbox" bind:checked={c.options.showControls} /> Control marks</label>
            {:else if c.kind === 'pace'}
              <label class="field">
                <span>Smoothing · {c.options.paceWindow} s</span>
                <input type="range" min="3" max="30" step="1" bind:value={c.options.paceWindow} />
              </label>
            {:else if c.kind === 'heartRate'}
              <label class="field">
                <span>Zone limits (bpm)</span>
                <input
                  type="text"
                  value={c.options.hrZones.join(', ')}
                  onchange={(e) => setZones(c, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {:else if c.kind === 'time'}
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showControls} /> Also show the leg time
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  checked={c.options.beforeStart === 'countdown'}
                  onchange={(e) =>
                    (c.options.beforeStart = (e.currentTarget as HTMLInputElement).checked ? 'countdown' : 'zero')}
                />
                Count down before the start
              </label>
            {:else if c.kind === 'distance'}
              <label class="check">
                <input type="checkbox" bind:checked={c.options.showControls} /> Also show the leg distance
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
