/**
 * Local project library in IndexedDB (STORY-38): project documents (JSON) + raster image blobs + thumbnails.
 * Nothing leaves the device.
 */
import { UserError } from '../i18n/core';
import { migrate, projectCounts, projectSummary, type ProjectCounts, type ProjectDoc } from './project';

const DB = 'omap-video';
const VERSION = 1;

export interface ProjectListItem {
  id: string;
  name: string;
  modified: number;
  thumbnail: string | null;
  /** English summary (logs); UIs should format `counts` in their language. */
  summary: string;
  counts: ProjectCounts;
}

interface ProjectRecord {
  id: string;
  name: string;
  modified: number;
  thumbnail: string | null;
  doc: ProjectDoc;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(stores, mode);
        let result: T;
        const req = fn(t);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('Storage transaction aborted'));
      }),
  );
}

/** Saves the document (and the raster image when given; `null` deletes it, `undefined` leaves it). */
export async function saveProject(doc: ProjectDoc, thumbnail: string | null, image?: Blob | null): Promise<void> {
  const rec: ProjectRecord = { id: doc.id, name: doc.name, modified: doc.modified, thumbnail, doc };
  await tx(['projects', 'blobs'], 'readwrite', (t) => {
    t.objectStore('projects').put(rec);
    if (image) t.objectStore('blobs').put(image, `${doc.id}:raster`);
    else if (image === null) t.objectStore('blobs').delete(`${doc.id}:raster`);
  });
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const all = await tx<ProjectRecord[]>(['projects'], 'readonly', (t) => t.objectStore('projects').getAll());
  return (all ?? [])
    .map((r) => ({
      id: r.id,
      name: r.name,
      modified: r.modified,
      thumbnail: r.thumbnail,
      summary: projectSummary(r.doc),
      counts: projectCounts(r.doc),
    }))
    .sort((a, b) => b.modified - a.modified);
}

export async function loadProject(id: string): Promise<{ doc: ProjectDoc; image: Blob | null }> {
  const rec = await tx<ProjectRecord | undefined>(['projects'], 'readonly', (t) => t.objectStore('projects').get(id));
  if (!rec) throw new UserError('err.projectNotFound');
  const image = await tx<Blob | undefined>(['blobs'], 'readonly', (t) => t.objectStore('blobs').get(`${id}:raster`));
  return { doc: migrate(rec.doc), image: image ?? null };
}

export async function deleteProject(id: string): Promise<void> {
  await tx(['projects', 'blobs'], 'readwrite', (t) => {
    t.objectStore('projects').delete(id);
    t.objectStore('blobs').delete(`${id}:raster`);
  });
}

export async function renameProject(id: string, name: string): Promise<void> {
  const rec = await tx<ProjectRecord | undefined>(['projects'], 'readonly', (t) => t.objectStore('projects').get(id));
  if (!rec) return;
  rec.name = name;
  rec.doc.name = name;
  await tx(['projects'], 'readwrite', (t) => t.objectStore('projects').put(rec));
}

/** Storage usage and quota (bytes), and asks the browser to keep the data (persistent storage). */
export async function storageInfo(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  let persisted = (await navigator.storage?.persisted?.()) ?? false;
  if (!persisted) persisted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}
