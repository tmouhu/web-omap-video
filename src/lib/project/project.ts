/**
 * Project document (EN-15): everything a user builds – GPX + edits, raster map + georeference, layers, course,
 * passing overrides, route choices and all settings – in one versioned, JSON-serialisable document.
 * Large binary data (the raster image) is stored next to it (IndexedDB blob / file in the .omvproj zip).
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DEFAULT_COURSE_CAMERA, type CourseCameraSettings } from '../anim/courseCamera';
import {
  DEFAULT_FREE_MODE,
  DEFAULT_ROUTE_DISPLAY,
  type FreeModeSettings,
  type RouteDisplaySettings,
} from '../anim/timeline';
import { defaultComponents, type ComponentConfig } from '../components/components';
import type { Course } from '../course/course';
import type { RouteChoice } from '../course/routes';
import { DEFAULT_EXPORT_RANGE, type ExportRangeSettings } from '../export/range';
import type { GpxEdit } from '../gpx/edits';
import type { GpxData, GpxPoint } from '../gpx/gpx';
import { defaultLayers, type LayerDesc } from '../map/layerModel';
import type { RasterGeoref } from '../raster/rasterMap';
import { DEFAULT_COURSE_STYLE, type CourseStyle } from '../render/overprint';
import { DEFAULT_SCENE_STYLE, type SceneStyle } from '../render/scene';

export const PROJECT_VERSION = 1;
export const PROJECT_EXT = 'omvproj';

/** Visual and export settings; also what presets (STORY-39) are made of. */
export interface ProjectSettings {
  free: FreeModeSettings;
  style: SceneStyle;
  courseStyle: CourseStyle;
  courseCamera: CourseCameraSettings;
  routeDisplay: RouteDisplaySettings;
  courseModeEnabled: boolean;
  components: ComponentConfig[];
  exportRange: ExportRangeSettings;
  exportMap: boolean;
  exportShortSide: number;
  exportFps: number;
  bitrateAuto: boolean;
  bitrateMbps: number;
  speed: number;
  aspect: number;
  frameCustom: { width: number; height: number } | null;
}

export function defaultSettings(): ProjectSettings {
  return {
    free: { ...DEFAULT_FREE_MODE },
    style: structuredClone(DEFAULT_SCENE_STYLE),
    courseStyle: { ...DEFAULT_COURSE_STYLE },
    courseCamera: { ...DEFAULT_COURSE_CAMERA },
    routeDisplay: { ...DEFAULT_ROUTE_DISPLAY },
    courseModeEnabled: true,
    components: defaultComponents(),
    exportRange: { ...DEFAULT_EXPORT_RANGE },
    exportMap: true,
    exportShortSide: 1080,
    exportFps: 30,
    bitrateAuto: true,
    bitrateMbps: 30,
    speed: 1,
    aspect: 16 / 9,
    frameCustom: null,
  };
}

/** Compact GPX point: [lat, lon, time, ele, hr, cad]. */
export type PackedPoint = [number, number, number | null, number | null, number | null, number | null];

export interface ProjectDoc {
  version: typeof PROJECT_VERSION;
  id: string;
  name: string;
  created: number;
  modified: number;
  gpx: { name: string; segments: number; points: PackedPoint[] } | null;
  gpxEdits: GpxEdit[];
  raster: {
    name: string;
    width: number;
    height: number;
    georef: RasterGeoref;
    printScale: number | null;
    imageType: string;
  } | null;
  layers: LayerDesc[];
  course: Course | null;
  routes: RouteChoice[];
  /** Manual passing times, absolute GPX-clock ms by course point id. */
  passingOverrides: Record<string, number>;
  matchRadius: number;
  settings: ProjectSettings;
}

export const newProjectId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function packGpx(g: GpxData, name: string): NonNullable<ProjectDoc['gpx']> {
  return { name, segments: g.segments, points: g.points.map((p) => [p.lat, p.lon, p.time, p.ele, p.hr, p.cad]) };
}

export function unpackGpx(g: NonNullable<ProjectDoc['gpx']>): GpxData {
  const points: GpxPoint[] = g.points.map(([lat, lon, time, ele, hr, cad]) => ({ lat, lon, time, ele, hr, cad }));
  return { name: g.name, segments: g.segments, points };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Deep-merges `value` over `defaults`: missing keys get defaults (new settings in newer app versions),
 * unknown keys are dropped, types must match. Arrays are taken from `value` as a whole.
 */
export function mergeDefaults<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (isObj(defaults)) {
    if (!isObj(value)) return defaults;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(defaults)) out[k] = mergeDefaults((defaults as Record<string, unknown>)[k], value[k]);
    return out as T;
  }
  if (defaults === null) return (value ?? null) as T;
  return (typeof value === typeof defaults ? value : defaults) as T;
}

/** Validates a parsed document and upgrades older versions (migrations go here). */
export function migrate(raw: unknown): ProjectDoc {
  if (!isObj(raw)) throw new Error('Not an OMap Video project.');
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > PROJECT_VERSION) throw new Error('This project was made with a newer version of the app.');
  if (version < 1) throw new Error('Unknown project format.');
  // v1 is current. Future: if (version === 1) raw = migrate1to2(raw) …
  const s = mergeDefaults(defaultSettings(), raw.settings);
  // Components: keep one per kind, defaults for missing kinds/keys.
  const byKind = new Map(
    (Array.isArray(raw.settings && (raw.settings as Record<string, unknown>).components)
      ? ((raw.settings as Record<string, unknown>).components as unknown[])
      : []
    )
      .filter(isObj)
      .map((c) => [c.kind, c]),
  );
  s.components = defaultComponents().map((d) => mergeDefaults(d, byKind.get(d.kind)));
  s.frameCustom =
    isObj(raw.settings) && isObj(raw.settings.frameCustom)
      ? mergeDefaults({ width: 800, height: 450 }, raw.settings.frameCustom)
      : null;
  return {
    version: PROJECT_VERSION,
    id: typeof raw.id === 'string' ? raw.id : newProjectId(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled project',
    created: typeof raw.created === 'number' ? raw.created : Date.now(),
    modified: typeof raw.modified === 'number' ? raw.modified : Date.now(),
    gpx: isObj(raw.gpx) && Array.isArray(raw.gpx.points) ? (raw.gpx as ProjectDoc['gpx']) : null,
    gpxEdits: Array.isArray(raw.gpxEdits) ? (raw.gpxEdits as GpxEdit[]) : [],
    raster: isObj(raw.raster) ? (raw.raster as ProjectDoc['raster']) : null,
    layers: Array.isArray(raw.layers) && raw.layers.length ? (raw.layers as LayerDesc[]) : defaultLayers(),
    course: isObj(raw.course) && Array.isArray(raw.course.points) ? (raw.course as unknown as Course) : null,
    routes: Array.isArray(raw.routes) ? (raw.routes as RouteChoice[]) : [],
    passingOverrides: isObj(raw.passingOverrides) ? (raw.passingOverrides as Record<string, number>) : {},
    matchRadius: typeof raw.matchRadius === 'number' ? raw.matchRadius : 50,
    settings: s,
  };
}

const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Builds the .omvproj file (zip): project.json + the raster image. */
export async function packProjectFile(doc: ProjectDoc, image: Blob | null): Promise<Blob> {
  const files: Record<string, Uint8Array> = { 'project.json': strToU8(JSON.stringify(doc)) };
  if (image && doc.raster)
    files[`raster.${IMAGE_EXT[image.type] ?? 'img'}`] = new Uint8Array(await image.arrayBuffer());
  return new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: 'application/zip' });
}

/** Reads a .omvproj file. */
export function unpackProjectFile(data: Uint8Array): { doc: ProjectDoc; image: Blob | null } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('The file is not an OMap Video project (.omvproj).');
  }
  const json = files['project.json'];
  if (!json) throw new Error('The project file has no project.json.');
  const doc = migrate(JSON.parse(strFromU8(json)));
  const imgName = Object.keys(files).find((f) => f.startsWith('raster.'));
  const image = imgName && doc.raster ? new Blob([files[imgName] as BlobPart], { type: doc.raster.imageType }) : null;
  return { doc, image };
}

/** One-line summary for project lists. */
export function projectSummary(doc: ProjectDoc): string {
  const parts: string[] = [];
  if (doc.gpx) parts.push(`${doc.gpx.points.length.toLocaleString('en')} GPS points`);
  if (doc.course) parts.push(`${doc.course.points.filter((p) => p.kind === 'control').length} controls`);
  if (doc.raster) parts.push('orienteering map');
  if (doc.routes.length) parts.push(`${doc.routes.length} routes`);
  return parts.join(' · ') || 'Empty';
}
