/**
 * Project persistence controller (STORY-38): debounced autosave to IndexedDB, project library operations and the
 * .omvproj project file. Only projects with content are saved.
 */
import { packProjectFile, PROJECT_EXT, unpackProjectFile } from '../lib/project/project';
import {
  deleteProject,
  listProjects,
  loadProject,
  renameProject,
  saveProject,
  type ProjectListItem,
} from '../lib/project/storage';
import { app } from './state.svelte';
import { errorText, t } from './i18n.svelte';

let lastImage: Blob | null = null;
let lastProjectId = '';
let timer: ReturnType<typeof setTimeout> | null = null;
/** Set while a project is being loaded, so loading does not trigger an autosave. */
let applying = false;

async function saveNow(): Promise<void> {
  if (!app.hasContent) return;
  app.saveState = 'saving';
  try {
    const doc = app.toDoc();
    const image = app.raster?.image ?? null;
    // Write the (large) image only when it changed or the project changed.
    const imageArg = image === lastImage && doc.id === lastProjectId ? undefined : image;
    await saveProject(doc, app.thumbnailProvider?.() ?? null, imageArg);
    lastImage = image;
    lastProjectId = doc.id;
    app.lastSaved = doc.modified;
    app.saveState = 'saved';
  } catch (e) {
    app.saveState = 'error';
    app.toast(t('msg.saveFailed', { msg: errorText(e) }), 'error');
  }
}

/** Starts autosave. Call once (App.svelte). Returns a cleanup function. */
export function startAutosave(delayMs = 1000): () => void {
  return $effect.root(() => {
    $effect(() => {
      // Everything that is part of the project document (but not the playhead / UI state).
      void [
        app.gpx,
        app.gpxEdits,
        app.raster,
        $state.snapshot(app.layers),
        app.course,
        app.routes,
        app.passingOverrides,
        app.matchRadius,
        app.projectName,
        app.settings(),
      ];
      if (applying || !app.hasContent) return;
      app.saveState = 'saving';
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void saveNow();
      }, delayMs);
    });
  });
}

/** Saves immediately (e.g. before switching projects). */
export async function flushSave(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    await saveNow();
  }
}

export async function openProject(id: string): Promise<void> {
  await flushSave();
  applying = true;
  try {
    const { doc, image } = await loadProject(id);
    await app.applyDoc(doc, image);
    lastImage = image;
    lastProjectId = doc.id;
    app.showProjects = false;
  } catch (e) {
    app.toast(t('msg.openFailed', { msg: errorText(e) }), 'error');
  } finally {
    // Let the effects of the load settle before autosave listens again.
    setTimeout(() => (applying = false), 0);
  }
}

export async function newProject(): Promise<void> {
  await flushSave();
  applying = true;
  app.newProject();
  app.showProjects = false;
  setTimeout(() => (applying = false), 0);
}

export async function newFromCurrent(): Promise<void> {
  // "New project from this one": keep map, georeference, layers and style; clear GPX, course and routes.
  await flushSave();
  const keep = {
    raster: app.raster,
    layers: $state.snapshot(app.layers),
    settings: app.settings(),
    name: app.projectName,
  };
  applying = true;
  const raster = keep.raster;
  app.raster = null; // keep the bitmaps alive (newProject would release them)
  app.newProject();
  app.raster = raster;
  app.layers = keep.layers as typeof app.layers;
  app.applySettings(keep.settings);
  app.projectName = `${keep.name} (copy)`;
  app.showProjects = false;
  lastImage = null;
  setTimeout(() => (applying = false), 0);
}

export const listAll = (): Promise<ProjectListItem[]> => listProjects();

export async function removeProject(id: string): Promise<void> {
  await deleteProject(id);
  if (id === app.projectId) {
    app.saveState = 'idle';
    app.lastSaved = null;
  }
}

export async function rename(id: string, name: string): Promise<void> {
  if (id === app.projectId) app.projectName = name;
  else await renameProject(id, name);
}

/** Downloads/saves the current project as a .omvproj file. */
export async function saveProjectFile(): Promise<void> {
  const blob = await packProjectFile(app.toDoc(), app.raster?.image ?? null);
  const name = `${app.projectName.replace(/[^\p{L}\p{N}_ -]+/gu, '_').trim() || 'project'}.${PROJECT_EXT}`;
  const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker;
  if (picker) {
    try {
      const h = await picker({
        suggestedName: name,
        types: [{ description: 'OMap Video project', accept: { 'application/zip': [`.${PROJECT_EXT}`] } }],
      });
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      app.toast(t('msg.savedTo', { name: h.name }), 'ok');
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

/** Opens a .omvproj file as a new local project (keeps its id so re-importing updates it). */
export async function openProjectFile(file: File): Promise<void> {
  await flushSave();
  applying = true;
  try {
    const { doc, image } = unpackProjectFile(new Uint8Array(await file.arrayBuffer()));
    await app.applyDoc(doc, image);
    app.showProjects = false;
    app.toast(t('msg.opened', { name: doc.name }), 'ok');
    lastImage = null; // force saving the image into this browser's library
    applying = false;
    await saveNow();
  } catch (e) {
    app.toast(errorText(e), 'error');
  } finally {
    applying = false;
  }
}

export function isProjectFile(f: File): boolean {
  return f.name.toLowerCase().endsWith(`.${PROJECT_EXT}`);
}
