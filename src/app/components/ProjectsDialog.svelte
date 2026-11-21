<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
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
      usage =
        t('proj.usage', { used: (s.usage / 1e6).toFixed(0), quota: (s.quota / 1e9).toFixed(1) }) +
        (s.persisted ? t('proj.kept') : '');
  }

  $effect(() => {
    if (app.showProjects) {
      dialog.showModal();
      void refresh();
    } else if (dialog.open) dialog.close();
  });

  function summary(c: ProjectListItem['counts']): string {
    const parts: string[] = [];
    if (c.points) parts.push(t('proj.points', { n: c.points.toLocaleString(i18n.locale === 'fi' ? 'fi' : 'en') }));
    if (c.controls) parts.push(t('proj.controls', { n: c.controls }));
    if (c.raster) parts.push(t('proj.map'));
    if (c.routes) parts.push(t('proj.routes', { n: c.routes }));
    return parts.join(' · ') || t('proj.emptySummary');
  }

  const fmt = (ms: number) =>
    new Date(ms).toLocaleString(i18n.locale === 'fi' ? 'fi' : 'en', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
</script>

<dialog
  bind:this={dialog}
  onclose={() => (app.showProjects = false)}
  aria-labelledby="projects-title"
  data-testid="projects-dialog"
>
  <header>
    <h2 id="projects-title">
      <img src="{import.meta.env.BASE_URL}icon-128.png" alt="" width="32" height="32" class="logo" />
      {t('proj.title')}
    </h2>
    <button class="btn ghost icon" aria-label={t('common.close')} onclick={() => (app.showProjects = false)}>✕</button>
  </header>
  <div class="actions">
    <button class="btn primary" onclick={() => newProject()} data-testid="project-new">{t('proj.new')}</button>
    <label class="btn">
      {t('proj.openFile')}
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
      {t('proj.sample')}
    </button>
    {#if app.raster}
      <button class="btn ghost" onclick={() => newFromCurrent()} title={t('proj.newFromMapTitle')}>
        {t('proj.newFromMap')}
      </button>
    {/if}
  </div>
  {#if items.length}
    <ul class="list" data-testid="project-list">
      {#each items as p (p.id)}
        <li class:current={p.id === app.projectId}>
          <button class="open" onclick={() => openProject(p.id)} aria-label={t('proj.openNamed', { name: p.name })}>
            {#if p.thumbnail}<img src={p.thumbnail} alt="" />{:else}<div class="ph"></div>{/if}
          </button>
          <div class="meta">
            <input
              type="text"
              value={p.name}
              aria-label={t('app.projectName')}
              onchange={async (e) => {
                await rename(p.id, (e.currentTarget as HTMLInputElement).value.trim() || p.name);
                await refresh();
              }}
            />
            <span class="small muted">{summary(p.counts)}</span>
            <span class="small muted">{fmt(p.modified)}{p.id === app.projectId ? t('proj.openNow') : ''}</span>
          </div>
          <div class="btns">
            <button class="btn sm" onclick={() => openProject(p.id)}>{t('proj.open')}</button>
            {#if confirmDelete === p.id}
              <button
                class="btn sm danger"
                onclick={async () => {
                  await removeProject(p.id);
                  confirmDelete = null;
                  await refresh();
                }}
              >
                {t('proj.deleteForGood')}
              </button>
            {:else}
              <button
                class="btn sm ghost"
                onclick={() => (confirmDelete = p.id)}
                aria-label={t('proj.deleteNamed', { name: p.name })}
              >
                {t('proj.delete')}
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted empty">
      {t('proj.empty')}
    </p>
  {/if}
  <footer class="small muted">
    {t('proj.footer', { usage: usage ? ` (${usage})` : '' })}
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
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    border-radius: 8px;
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
