<script lang="ts">
  /** "Add layer" dialog (STORY-17): WMS / WMTS by capabilities URL, or an XYZ tile URL template. */
  import { app } from '../state.svelte';
  import { fetchCapabilities, type CapabilityLayer, type ServiceInfo } from '../../lib/map/capabilities';
  import { newLayerId, sourceCrs } from '../../lib/map/layerModel';
  import { crsName } from '../../lib/geo/crs';

  let { onclose }: { onclose: () => void } = $props();

  let mode = $state<'service' | 'xyz'>('service');
  let url = $state('');
  let loading = $state(false);
  let error = $state('');
  let service = $state.raw<ServiceInfo | null>(null);
  let filter = $state('');
  let selected = $state.raw<CapabilityLayer | null>(null);
  let attribution = $state('');
  let xyzUrl = $state('');
  let xyzTitle = $state('');
  let dialog: HTMLDialogElement;

  const shown = $derived(
    service ? service.layers.filter((l) => (l.title + ' ' + l.id).toLowerCase().includes(filter.toLowerCase())) : [],
  );

  $effect(() => {
    dialog.showModal();
  });

  async function load() {
    error = '';
    service = null;
    selected = null;
    loading = true;
    try {
      service = await fetchCapabilities(url.trim());
      if (!service.layers.length) error = 'The service lists no layers.';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function choose(l: CapabilityLayer) {
    selected = l;
    attribution = 'attribution' in l.desc ? l.desc.attribution : '';
  }

  function add() {
    if (mode === 'service' && selected) {
      app.addLayer({ ...selected.desc, attribution } as typeof selected.desc);
    } else if (mode === 'xyz' && /\{z\}/.test(xyzUrl) && /\{x\}/.test(xyzUrl) && /\{y\}/.test(xyzUrl)) {
      app.addLayer({
        id: newLayerId('xyz'),
        kind: 'xyz',
        title: xyzTitle || 'Tile layer',
        visible: true,
        opacity: 1,
        url: xyzUrl.trim(),
        maxZoom: 19,
        attribution,
      });
    } else return;
    close();
  }

  function close() {
    dialog.close();
    onclose();
  }

  const canAdd = $derived(
    !!attribution.trim() &&
      (mode === 'service' ? !!selected : /\{z\}/.test(xyzUrl) && /\{x\}/.test(xyzUrl) && /\{y\}/.test(xyzUrl)),
  );
</script>

<dialog bind:this={dialog} {onclose} aria-labelledby="add-layer-title" data-testid="add-layer-dialog">
  <header>
    <h2 id="add-layer-title">Add map layer</h2>
    <button class="btn ghost icon" aria-label="Close" onclick={close}>✕</button>
  </header>

  <div class="seg" role="group" aria-label="Layer type">
    <button aria-pressed={mode === 'service'} onclick={() => (mode = 'service')}>WMS / WMTS service</button>
    <button aria-pressed={mode === 'xyz'} onclick={() => (mode = 'xyz')}>XYZ tile URL</button>
  </div>

  {#if mode === 'service'}
    <form
      class="urlrow"
      onsubmit={(e) => {
        e.preventDefault();
        load();
      }}
    >
      <input
        type="text"
        placeholder="https://example.org/wmts?request=GetCapabilities"
        bind:value={url}
        aria-label="Service or capabilities URL"
        data-testid="service-url"
      />
      <button class="btn primary" type="submit" disabled={!url.trim() || loading}>
        {loading ? 'Loading…' : 'Fetch'}
      </button>
    </form>
    {#if service}
      <div class="svc">
        <span class="tag">{service.type}</span> <strong>{service.title}</strong>
        <span class="muted small">· {service.layers.length} layers</span>
      </div>
      {#if service.layers.length > 8}
        <input type="text" placeholder="Filter layers…" bind:value={filter} aria-label="Filter layers" />
      {/if}
      <ul class="list" data-testid="service-layers">
        {#each shown as l (l.id)}
          <li>
            <button class:sel={selected?.id === l.id} onclick={() => choose(l)}>
              <strong>{l.title}</strong>
              <span class="muted small">{l.id} · {crsName(sourceCrs(l.desc, app.crs.code))}</span>
              {#if l.abstract}<span class="muted small abs">{l.abstract}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <label class="field">
      <span>Tile URL template</span>
      <input type="text" placeholder="https://tiles.example.org/{'{z}'}/{'{x}'}/{'{y}'}.png" bind:value={xyzUrl} />
    </label>
    <label class="field">
      <span>Name</span>
      <input type="text" placeholder="My tile layer" bind:value={xyzTitle} />
    </label>
  {/if}

  {#if (mode === 'service' && selected) || mode === 'xyz'}
    <label class="field">
      <span>Attribution (required by most map licences)</span>
      <input type="text" bind:value={attribution} placeholder="© Map provider" data-testid="layer-attribution" />
    </label>
  {/if}
  {#if error}<p class="note err" role="alert">{error}</p>{/if}
  <p class="muted small">
    The service must allow use from web apps (CORS); otherwise the video cannot be exported and the layer is rejected.
  </p>

  <footer>
    <button class="btn" onclick={close}>Cancel</button>
    <button class="btn primary" disabled={!canAdd} onclick={add} data-testid="add-layer-confirm">Add layer</button>
  </footer>
</dialog>

<style>
  dialog {
    width: min(560px, calc(100vw - 32px));
    max-height: min(720px, calc(100vh - 48px));
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    background: var(--bg-elev);
    color: var(--text);
    padding: 18px 20px;
    box-shadow: var(--shadow);
  }
  dialog[open] {
    display: grid;
    gap: 12px;
  }
  dialog::backdrop {
    background: rgba(5, 7, 10, 0.6);
    backdrop-filter: blur(2px);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  footer {
    justify-content: flex-end;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  .urlrow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  .svc {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 260px;
    overflow-y: auto;
    display: grid;
    gap: 4px;
  }
  .list button {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 1px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-input);
  }
  .list button.sel {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .abs {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
