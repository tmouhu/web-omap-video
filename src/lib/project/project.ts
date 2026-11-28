/**
 * Project document (EN-15): everything a user builds – GPX + edits, raster map + georeference, layers, course,
 * passing overrides, route choices and all settings – in one versioned, JSON-serialisable document.
 * Large binary data (the raster image) is stored next to it (IndexedDB blob / file in the .omvproj zip).
 */
import { UserError } from '../i18n/core';
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
import type { VideoLocale } from '../i18n/core';
import type { RouteChoice } from '../course/routes';
import { DEFAULT_EXPORT_RANGE, type ExportRangeSettings } from '../export/range';
import type { GpxEdit } from '../gpx/edits';
import type { GpxData, GpxPoint } from '../gpx/gpx';
import { defaultLayers, type LayerDesc } from '../map/layerModel';
import type { RasterGeoref } from '../raster/rasterMap';
import type { ResultsDoc } from '../results/results';
import { DEFAULT_COURSE_STYLE, type CourseStyle } from '../render/overprint';
import { DEFAULT_SCENE_STYLE, type SceneStyle } from '../render/scene';
import { upgradeLegacyTimes, type TimeBase } from './timeBase';

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
  /** Real-time transition clips (STORY-46) and their padding (s). */
  exportTransitionClips: boolean;
  transitionClipPad: number;
  exportShortSide: number;
  exportFps: number;
  bitrateAuto: boolean;
  bitrateMbps: number;
  speed: number;
  /** Unit of all display/animation durations (STORY-47). */
  timeBase: TimeBase;
  aspect: number;
  frameCustom: { width: number; height: number } | null;
  /** Language of texts in the exported videos (STORY-40). */
  videoLocale: VideoLocale;
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
    exportTransitionClips: false,
    transitionClipPad: 3,
    exportShortSide: 1080,
    exportFps: 30,
    bitrateAuto: true,
    bitrateMbps: 30,
    speed: 1,
    timeBase: 'video',
    aspect: 16 / 9,
    frameCustom: null,
    videoLocale: 'en',
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
  /** Imported results (STORY-41), null if none. */
  results: ResultsDoc | null;
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
  if (!isObj(raw)) throw new UserError('err.notProject');
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > PROJECT_VERSION) throw new UserError('err.projectNewer');
  if (version < 1) throw new UserError('err.projectUnknown');
  // v1 is current. Future: if (version === 1) raw = migrate1to2(raw) …
  // Before STORY-47 there was no global time base: convert the mixed units of the saved values (not the defaults
  // filled in below) to video seconds, so the project renders the same.
  let settings: unknown = raw.settings;
  if (isObj(settings) && settings.timeBase === undefined) {
    const rs = structuredClone(settings);
    const rd = rs.routeDisplay;
    const routeBase: TimeBase = isObj(rd) && rd.timeBase === 'real' ? 'real' : 'video';
    const speed = typeof rs.speed === 'number' && rs.speed > 0 ? rs.speed : 1;
    upgradeLegacyTimes(rs as Partial<ProjectSettings>, routeBase, 'video', speed);
    settings = { ...rs, timeBase: 'video' };
  }
  const s = mergeDefaults(defaultSettings(), settings);
  // Components: keep one per kind, defaults for missing kinds/keys.
  const byKind = new Map(
    (isObj(settings) && Array.isArray(settings.components) ? (settings.components as unknown[]) : [])
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
    results: isObj(raw.results) && isObj(raw.results.cls) ? migrateResults(raw.results) : null,
    settings: s,
  };
}

function migrateResults(r: Record<string, unknown>): ResultsDoc {
  return {
    ...mergeDefaults<Omit<ResultsDoc, 'cls'>>(
      {
        source: '',
        version: '3.0',
        event: '',
        date: null,
        runner: null,
        reference: 'ok',
        clockOffset: 0,
        tzOffsetMin: null,
      },
      r,
    ),
    cls: r.cls as ResultsDoc['cls'],
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
    throw new UserError('err.notProjectFile');
  }
  const json = files['project.json'];
  if (!json) throw new UserError('err.projectNoJson');
  const doc = migrate(JSON.parse(strFromU8(json)));
  const imgName = Object.keys(files).find((f) => f.startsWith('raster.'));
  const image = imgName && doc.raster ? new Blob([files[imgName] as BlobPart], { type: doc.raster.imageType }) : null;
  return { doc, image };
}

export interface ProjectCounts {
  points: number;
  controls: number;
  raster: boolean;
  routes: number;
}

export function projectCounts(doc: ProjectDoc): ProjectCounts {
  return {
    points: doc.gpx?.points.length ?? 0,
    controls: doc.course?.points.filter((p) => p.kind === 'control').length ?? 0,
    raster: !!doc.raster,
    routes: doc.routes.length,
  };
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
