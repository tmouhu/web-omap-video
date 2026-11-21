<script lang="ts">
  import { app } from './state.svelte';
  import MapStage from './components/MapStage.svelte';
  import Inspector from './components/Inspector.svelte';
  import TimelineBar from './components/TimelineBar.svelte';
  import WorkflowRail from './components/WorkflowRail.svelte';
  import ProjectsDialog from './components/ProjectsDialog.svelte';
  import ShortcutsDialog from './components/ShortcutsDialog.svelte';
  import Toaster from './components/Toaster.svelte';
  import { onMount } from 'svelte';
  import { listAll, saveProjectFile, startAutosave } from './projects.svelte';

  onMount(() => {
    const stop = startAutosave();
    // Start screen: offer the saved projects when there are any (STORY-37/38).
    listAll()
      .then((l) => {
        if (l.length && !app.hasContent) app.showProjects = true;
      })
      .catch(() => {});
    return stop;
  });

  // Theme: explicit choice or the system preference.
  $effect(() => {
    const pref = app.theme;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      document.documentElement.dataset.theme = pref === 'system' ? (mq.matches ? 'light' : 'dark') : pref;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  });

  const saveLabel = $derived(
    app.saveState === 'saving'
      ? 'Saving…'
      : app.saveState === 'error'
        ? 'Not saved'
        : app.saveState === 'saved' && app.lastSaved
          ? `Saved ${new Date(app.lastSaved).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
          : app.hasContent
            ? 'Not saved yet'
            : '',
  );
  const nextTheme = { system: 'dark', dark: 'light', light: 'system' } as const;

  /** Editing shortcuts: undo/redo, Delete, Enter, Escape (playback keys live in TimelineBar). */
  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('input:not([type=range]):not([type=checkbox]), select, textarea')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === '?') {
      app.showShortcuts = !app.showShortcuts;
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveProjectFile();
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) app.redo();
      else app.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      app.redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (app.tool === 'course' && app.selectedPointId) {
        e.preventDefault();
        app.courseRemove(app.selectedPointId);
      } else if (app.tool === 'gpx' && app.selectedTrackIndex !== null) {
        e.preventDefault();
        app.addGpxEdit({ type: 'delete', from: app.selectedTrackIndex, to: app.selectedTrackIndex });
      }
    } else if (e.key === 'Enter') {
      if (app.tool === 'course') app.courseFinish();
      else if (app.tool === 'gpx-redraw') app.commitRedraw();
      else if (app.tool === 'route') app.finishRoute();
    } else if (e.key === 'Escape') {
      if (app.tool === 'gpx-redraw') {
        app.redrawPath = [];
        app.tool = 'gpx';
      } else if (app.tool === 'route' && app.routeDraft.length) {
        app.routeDraft = [];
      } else if (app.tool !== 'none') app.setTool('none');
      else if (app.georef.active) app.cancelGeoref();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="shell">
  <header class="top">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--accent)" stroke-width="2.2" /><path
          d="M12 6.5 16 15l-4-2-4 2z"
          fill="var(--accent)"
        />
      </svg>
      <span>OMap Video</span>
    </div>
    <div class="project">
      <button class="btn sm ghost" onclick={() => (app.showProjects = true)} data-testid="open-projects">
        ☰ Projects
      </button>
      <input
        class="pname"
        type="text"
        aria-label="Project name"
        data-testid="project-name"
        value={app.projectName}
        onchange={(e) => (app.projectName = (e.currentTarget as HTMLInputElement).value.trim() || 'Untitled project')}
      />
      <span class="save {app.saveState}" data-testid="save-state">{saveLabel}</span>
    </div>
    <div class="right">
      <button
        class="btn ghost icon"
        title="Undo (⌘/Ctrl Z)"
        aria-label="Undo"
        disabled={!app.canUndo}
        onclick={() => app.undo()}
      >
        ↶
      </button>
      <button
        class="btn ghost icon"
        title="Redo (⇧⌘/Ctrl Z)"
        aria-label="Redo"
        disabled={!app.canRedo}
        onclick={() => app.redo()}
      >
        ↷
      </button>
      <button
        class="btn sm"
        disabled={!app.hasContent}
        onclick={() => saveProjectFile()}
        title="Save a project file (.omvproj) for backup or another computer (⌘/Ctrl S)"
        data-testid="save-project-file"
      >
        Save file
      </button>
      <button
        class="btn ghost icon"
        title="Theme: {app.theme}"
        aria-label="Switch theme (now {app.theme})"
        data-testid="theme"
        onclick={() => app.setTheme(nextTheme[app.theme])}
      >
        {app.theme === 'light' ? '☀' : app.theme === 'dark' ? '☾' : '◐'}
      </button>
      <button
        class="btn ghost icon"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        onclick={() => (app.showShortcuts = true)}
      >
        ?
      </button>
    </div>
  </header>
  <main class="main">
    <WorkflowRail />
    <MapStage />
    <Inspector />
  </main>
  <TimelineBar />
</div>
<ProjectsDialog />
<ShortcutsDialog />
<Toaster />

<style>
  .shell {
    height: 100%;
    display: grid;
    grid-template-rows: 52px 1fr auto;
    min-width: 1024px;
  }
  .top {
    display: grid;
    grid-template-columns: 200px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 0 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .project {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .pname {
    max-width: 320px;
    height: 30px;
    font-weight: 600;
    background: transparent;
    border-color: transparent;
  }
  .pname:hover,
  .pname:focus {
    background: var(--bg-input);
    border-color: var(--border);
  }
  .save {
    font-size: 12px;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .save.error {
    color: var(--danger);
  }
  .save.saved {
    color: var(--ok);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .main {
    display: grid;
    grid-template-columns: 76px 1fr 340px;
    min-height: 0;
  }
</style>
