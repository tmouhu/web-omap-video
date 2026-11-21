<script lang="ts">
  /** Start screen / project library (STORY-37/38): recent projects, new, open file, sample. */
  import { app } from '../state.svelte';
  import {
    listAll,
    newFromCurrent,
    newProject,
    openProject,
    openProjectFile,
    removeProject,
    rename,
  } from '../projects.svelte';
  import { storageInfo } from '../../lib/project/storage';
  import type { ProjectListItem } from '../../lib/project/storage';

  let dialog: HTMLDialogElement;
  let items = $state<ProjectListItem[]>([]);
  let usage = $state('');
  let confirmDelete = $state<string | null>(null);

  async function refresh() {
    items = await listAll().catch(() => []);
    const s = await storageInfo().catch(() => null);
    if (s && s.quota)
      usage = `${(s.usage / 1e6).toFixed(0)} MB of ${(s.quota / 1e9).toFixed(1)} GB used${s.persisted ? ' · kept by the browser' : ''}`;
  }

  $effect(() => {
    if (app.showProjects) {
      dialog.showModal();
      void refresh();
    } else if (dialog.open) dialog.close();
  });

  const fmt = (ms: number) =>
    new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<dialog
  bind:this={dialog}
  onclose={() => (app.showProjects = false)}
  aria-labelledby="projects-title"
  data-testid="projects-dialog"
>
  <header>
    <h2 id="projects-title">Projects</h2>
    <button class="btn ghost icon" aria-label="Close" onclick={() => (app.showProjects = false)}>✕</button>
  </header>
  <div class="actions">
    <button class="btn primary" onclick={() => newProject()} data-testid="project-new">New project</button>
    <label class="btn">
      Open project file…
      <input
        type="file"
        accept=".omvproj"
        hidden
        data-testid="project-open-file"
        onchange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) openProjectFile(f);
        }}
      />
    </label>
    <button
      class="btn"
      onclick={async () => {
        await newProject();
        await app.loadSampleProject();
      }}
      data-testid="project-sample"
    >
      Open sample project
    </button>
    {#if app.raster}
      <button
        class="btn ghost"
        onclick={() => newFromCurrent()}
        title="Keep the map, layers and style; start without GPX and course"
      >
        New from this map
      </button>
    {/if}
  </div>
  {#if items.length}
    <ul class="list" data-testid="project-list">
      {#each items as p (p.id)}
        <li class:current={p.id === app.projectId}>
          <button class="open" onclick={() => openProject(p.id)} aria-label="Open {p.name}">
            {#if p.thumbnail}<img src={p.thumbnail} alt="" />{:else}<div class="ph"></div>{/if}
          </button>
          <div class="meta">
            <input
              type="text"
              value={p.name}
              aria-label="Project name"
              onchange={async (e) => {
                await rename(p.id, (e.currentTarget as HTMLInputElement).value.trim() || p.name);
                await refresh();
              }}
            />
            <span class="small muted">{p.summary}</span>
            <span class="small muted">{fmt(p.modified)}{p.id === app.projectId ? ' · open now' : ''}</span>
          </div>
          <div class="btns">
            <button class="btn sm" onclick={() => openProject(p.id)}>Open</button>
            {#if confirmDelete === p.id}
              <button
                class="btn sm danger"
                onclick={async () => {
                  await removeProject(p.id);
                  confirmDelete = null;
                  await refresh();
                }}
              >
                Delete for good
              </button>
            {:else}
              <button class="btn sm ghost" onclick={() => (confirmDelete = p.id)} aria-label="Delete {p.name}">
                Delete
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted empty">
      No saved projects yet. Your work is saved automatically in this browser as soon as you add a GPX, a map or a
      course.
    </p>
  {/if}
  <footer class="small muted">
    Projects are stored only in this browser{usage ? ` (${usage})` : ''}. Use “Save project file” to back up or move
    them.
  </footer>
</dialog>

<style>
  dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: min(780px, calc(100vh - 48px));
    border: 1px solid var(--border-strong);
    border-radius: 16px;
    background: var(--bg-elev);
    color: var(--text);
    padding: 20px 22px;
    box-shadow: var(--shadow);
  }
  dialog[open] {
    display: grid;
    gap: 14px;
  }
  dialog::backdrop {
    background: rgba(5, 7, 10, 0.65);
    backdrop-filter: blur(3px);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 19px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
    overflow-y: auto;
    max-height: 480px;
  }
  .list li {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-input);
  }
  .list li.current {
    border-color: var(--accent);
  }
  .open {
    padding: 0;
    border: 0;
    background: none;
  }
  img,
  .ph {
    width: 160px;
    height: 90px;
    object-fit: cover;
    border-radius: 8px;
    display: block;
    background: var(--bg-elev-2);
  }
  .meta {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .meta input {
    font-weight: 600;
    height: 28px;
  }
  .btns {
    display: grid;
    gap: 4px;
  }
  .danger {
    border-color: var(--danger);
    color: var(--danger);
  }
  .empty {
    margin: 0;
  }
</style>
