/** Global app state (Svelte 5 runes). Heavy objects use $state.raw (not deeply proxied). */
import { DEFAULT_COURSE_CAMERA, type CourseCameraSettings } from '../lib/anim/courseCamera';
import {
  DEFAULT_FREE_MODE,
  DEFAULT_ROUTE_DISPLAY,
  Timeline,
  type FreeModeSettings,
  type RouteDisplaySettings,
} from '../lib/anim/timeline';
import { legIndexOf, newRouteId, nextLabelAndColor, routesForLeg, type RouteChoice } from '../lib/course/routes';
import type { ProjectScene } from '../lib/render/frameScene';
import type { VideoLocale } from '../lib/i18n/core';
import { errorText, i18n, t, t as translateMsg } from './i18n.svelte';
import { defaultComponents, type ComponentConfig, type SplitEvent } from '../lib/components/components';
import { isResultListXml, parseResultList, type ResultFile, type ResultsDoc } from '../lib/results/results';
import {
  compareSplits,
  guessTzOffset,
  mapCourseToResults,
  punchTimes,
  residuals,
  runnerStartMs,
  suggestClockOffset,
  type SplitRow,
} from '../lib/results/splits';
import { fetchResultsFromUrl, searchEvents, type NavisportEvent } from '../lib/results/navisport';
import {
  defaultSettings,
  mergeDefaults,
  newProjectId,
  packGpx,
  PROJECT_VERSION,
  unpackGpx,
  type ProjectDoc,
  type ProjectSettings,
} from '../lib/project/project';
import { DEFAULT_EXPORT_RANGE, resolveRange, type ExportRangeSettings, type ResolvedRange } from '../lib/export/range';
import { forward, isKnownCrs, selectViewCrs, utmCrs, type CrsInfo } from '../lib/geo/crs';
import type { LatLon } from '../lib/geo/geo';
import {
  appendPoint,
  emptyCourse,
  finishAtLast,
  insertControl,
  isValidCourse,
  movePoint,
  removePoint,
  reorderControl,
  updatePoint,
  type Course,
} from '../lib/course/course';
import { parseIofCourseData } from '../lib/course/iofxml';
import { matchCourse, validateOverride, type Passing } from '../lib/course/match';
import { applyEdits, deleteEditsFor, findOutliers, type GpxEdit } from '../lib/gpx/edits';
import { GpxError, parseGpx, type GpxData } from '../lib/gpx/gpx';
import { creditsText, defaultLayers, type LayerDesc } from '../lib/map/layerModel';
import { fitTransform, type Affine, type FitResult, type Pt } from '../lib/raster/affine';
import { isRasterFile, isWorldFileOnly, readRasterFiles, readWorldFile, type RasterSource } from '../lib/raster/load';
import {
  buildPyramid,
  georefFromCorners,
  placedGeoref,
  rasterCenter,
  rasterNorthRotation,
  releaseRaster,
  type RasterGeoref,
  type RasterMap,
} from '../lib/raster/rasterMap';
import { DEFAULT_COURSE_STYLE, type CourseStyle } from '../lib/render/overprint';
import { DEFAULT_SCENE_STYLE, type SceneStyle } from '../lib/render/scene';
import { Track } from '../lib/track/track';
import { convertTimedSettings, timeScaleFor, type TimeBase } from '../lib/project/timeBase';

export const ASPECTS = [
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
] as const;

export const SCALE_PRESETS = [2500, 4000, 5000, 7500, 10000, 15000, 25000, 50000];
export const SPEED_PRESETS = [0.5, 1, 2, 5, 10, 30];
export const MIN_FRAME = { width: 160, height: 90 };

export interface ExportFileView {
  id: string;
  /** 'map' or a component kind. */
  kind: string;
  label: string;
  url: string;
  file: File;
  name: string;
  savedToDisk: boolean;
}

export interface ExportResultView {
  files: ExportFileView[];
  codec: string;
  frames: number;
  seconds: number;
  elapsedMs: number;
  /** Folder the files were written to (File System Access), if any. */
  folder: string | null;
  /** GPX clock time of the first frame (epoch ms), for lining up with the head cam in the editor. */
  firstFrameClock: number | null;
}

export interface GeorefPair {
  pixel: Pt;
  /** True position (WGS84), so pairs survive view-CRS changes. */
  target: LatLon;
}

export type InspectorTab = 'map' | 'gpx' | 'course' | 'routes' | 'style' | 'export';

/** Map editing tool that owns map clicks/drags (one at a time). */
export type Tool = 'none' | 'course' | 'gpx' | 'gpx-redraw' | 'pick-passing' | 'route';

/** Undoable project state (EN-15 lite: snapshots, until the full project model exists). */
interface Snapshot {
  course: Course | null;
  gpxEdits: GpxEdit[];
  overrides: Record<string, number>;
  routes: RouteChoice[];
}

/** A world-file raster whose CRS could not be determined; waits for the user's choice. */
export interface PendingRaster {
  source: RasterSource & { georef: { kind: 'affine' } };
  levels: ImageBitmap[];
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'error';
}

export type ThemePref = 'system' | 'dark' | 'light';

/** CRS code from the CRS chooser (`UTM<zone>` = WGS84 / UTM zone N). */
const crsFromChoice = (code: string): string =>
  code.startsWith('UTM') ? utmCrs({ lat: 10, lon: +code.slice(3) * 6 - 183 }).code : code;

const loadTheme = (): ThemePref => {
  try {
    const v = localStorage.getItem('omv-theme');
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
};

class AppState {
  // --- Project (EN-15 / STORY-38) ---
  projectId = $state(newProjectId());
  projectName = $state(t('app.untitled'));
  projectCreated = Date.now();
  saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  lastSaved = $state<number | null>(null);
  /** Opened at start when saved projects exist, or from the top bar. */
  showProjects = $state(false);
  showShortcuts = $state(false);
  toasts = $state<Toast[]>([]);
  theme = $state<ThemePref>(loadTheme());
  /** Set by MapStage: renders a small JPEG data URL of the preview for the project list. */
  thumbnailProvider: (() => string | null) | null = null;
  private toastSeq = 0;
  /** Original GPX as loaded; never modified (STORY-21). */
  gpx = $state.raw<GpxData | null>(null);
  gpxName = $state('');
  /** Non-destructive edits applied to the original points, in order. */
  gpxEdits = $state.raw<GpxEdit[]>([]);
  /** Edit being dragged right now (previewed, committed on release). */
  dragEdit = $state.raw<GpxEdit | null>(null);
  /** The edited track used everywhere (playback, matching, export). */
  track: Track | null = $derived.by(() => {
    if (!this.gpx) return null;
    const edits = this.dragEdit ? [...this.gpxEdits, this.dragEdit] : this.gpxEdits;
    return new Track(this.gpxName, edits.length ? applyEdits(this.gpx.points, edits) : this.gpx.points);
  });
  showOriginalGpx = $state(false);
  error = $state('');

  // --- Course (EPIC-3) ---
  course = $state.raw<Course | null>(null);
  courseStyle = $state<CourseStyle>({ ...DEFAULT_COURSE_STYLE });
  courseError = $state('');
  selectedPointId = $state<string | null>(null);
  /** Manual passing times: absolute ms (GPX clock) by course point id, so GPX trimming does not move them. */
  passingOverrides = $state.raw<Record<string, number>>({});
  matchRadius = $state(50);
  /** Courses found in an imported IOF XML file with several courses (user picks one). */
  importedCourses = $state.raw<Course[]>([]);
  /** Passing times (one per course point) or null when there is no valid course + track. */
  passings: Passing[] | null = $derived.by(() => {
    const t = this.track;
    const c = this.course;
    if (!t || !isValidCourse(c)) return null;
    const base = t.startTime ?? 0;
    const overrides: Record<string, number> = {};
    for (const [id, abs] of Object.entries(this.passingOverrides)) overrides[id] = (abs - base) / 1000;
    return matchCourse(t, c, { radius: this.matchRadius, overrides });
  });

  // --- Results (STORY-41) ---
  /** Imported result list (chosen class), runner and sync settings. */
  results = $state.raw<ResultsDoc | null>(null);
  /** A parsed file with several classes, waiting for the class choice. */
  pendingResults = $state.raw<{ file: ResultFile; source: string } | null>(null);
  resultsError = $state('');
  resultsLoading = $state(false);
  /** Result row index per course point (-1 start, n finish, null unmatched). */
  resultMap: (number | null)[] | null = $derived(
    this.results && this.course ? mapCourseToResults(this.course, this.results.cls.controls) : null,
  );
  /** Split comparison of the chosen runner (controls + finish). */
  splitRows: SplitRow[] | null = $derived(
    this.results && this.results.runner !== null
      ? compareSplits(this.results.cls, this.results.runner, this.results.reference)
      : null,
  );
  /** Runner's start in GPX-clock ms (IOF 2.0 local time: zone from the project or guessed from the GPX). */
  resultStartMs: number | null = $derived.by(() => {
    const r = this.results;
    const c = r && r.runner !== null ? r.cls.competitors[r.runner] : null;
    if (!r || !c) return null;
    const tz = r.tzOffsetMin ?? (this.track ? guessTzOffset(c, r.date, this.track) : null) ?? 0;
    return runnerStartMs(c, r.date, tz);
  });
  /** Distance (m) between the track at each punch time and its course point, with the current clock offset. */
  punchResiduals: (number | null)[] | null = $derived.by(() => {
    const r = this.results;
    const c = this.course;
    const map = this.resultMap;
    const start = this.resultStartMs;
    if (!r || r.runner === null || !c || !map || start === null || !this.track) return null;
    return residuals(c, map, r.cls.competitors[r.runner], start, r.clockOffset, this.track);
  });
  /** Control passings with their split rows, for the splits video component. */
  splitEvents: SplitEvent[] | null = $derived.by(() => {
    const rows = this.splitRows;
    const map = this.resultMap;
    const ps = this.passings;
    const c = this.course;
    if (!rows || !map || !ps || !c) return null;
    const out: SplitEvent[] = [];
    let n = 0;
    c.points.forEach((p, k) => {
      if (p.kind === 'control') n++;
      const r = map[k];
      if (r === null || r < 0 || !rows[r] || ps[k].status === 'not-found') return;
      out.push({ t: ps[k].t, number: n, row: rows[r] });
    });
    return out.sort((a, b) => a.t - b.t);
  });

  // --- Course-mode animation (EPIC-4) ---
  /** Use the leg-by-leg camera when a valid course and passings exist. */
  courseModeEnabled = $state(true);
  courseCamera = $state<CourseCameraSettings>({ ...DEFAULT_COURSE_CAMERA });
  routeDisplay = $state<RouteDisplaySettings>({ ...DEFAULT_ROUTE_DISPLAY });
  /** Route choices of all legs (STORY-30). */
  routes = $state.raw<RouteChoice[]>([]);
  /** Leg selected for drawing route choices (index of its first point). */
  routeLeg = $state(0);
  /** Route being drawn (tool 'route'). */
  routeDraft = $state.raw<LatLon[]>([]);
  /** Snap the first/last point of a drawn route to the leg's controls. */
  routeSnap = $state(true);
  /** Paused preview shows the exact video frame at the playhead (else free north-up navigation). */
  followFrame = $state(true);
  courseMode = $derived(this.courseModeEnabled && !!this.passings && isValidCourse(this.course));

  // --- Tools & selection ---
  inspectorTab = $state<InspectorTab>('map');
  tool = $state<Tool>('none');
  /** Course point whose passing time is picked by clicking the track ('pick-passing'). */
  pickPassingId = $state<string | null>(null);
  /** Selected track point index (GPX editor). */
  selectedTrackIndex = $state<number | null>(null);
  /** GPX editor brush radius (m): neighbours within it follow a dragged point. */
  brushRadius = $state(15);
  /** Time range [a, b] (track s) for range edits, set from the playhead. */
  editRange = $state<[number | null, number | null]>([null, null]);
  /** Points of a path being drawn for 'gpx-redraw'. */
  redrawPath = $state.raw<LatLon[]>([]);

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  canUndo = $state(false);
  canRedo = $state(false);
  time = $state(0);
  playing = $state(false);
  speed = $state(1);
  /** Unit of every display/animation duration in the settings (STORY-47). */
  timeBase = $state<TimeBase>('video');
  /** Track seconds per settings second. */
  timeScale = $derived(timeScaleFor(this.timeBase, this.speed));
  free = $state<FreeModeSettings>({ ...DEFAULT_FREE_MODE });
  style = $state<SceneStyle>({ ...DEFAULT_SCENE_STYLE });

  /** Aspect ratio of the frame (width / height). */
  aspect = $state(16 / 9);
  /** Freely resized frame size (CSS px); null = largest frame of `aspect` that fits the stage. */
  frameCustom = $state<{ width: number; height: number } | null>(null);
  /** Actual preview frame size in CSS px (set by MapStage). */
  frame = $state({ width: 0, height: 0 });
  /** Current map view centre (view CRS), kept by MapStage; used to place unreferenced rasters. */
  viewCenter: Pt = [430000, 7200000];

  // --- Map layers and raster map (EPIC-2) ---
  layers = $state<LayerDesc[]>(defaultLayers());
  raster = $state.raw<RasterMap | null>(null);
  /** Tile load counters per layer id (STORY-17: detect services whose tiles cannot be used). */
  layerHealth = $state<Record<string, { ok: number; error: number }>>({});
  rasterError = $state('');
  rasterLoading = $state(false);
  pendingRaster = $state.raw<PendingRaster | null>(null);
  /** World file for the loaded raster whose CRS could not be determined; waits for the user's choice. */
  pendingWorldFile = $state.raw<Affine | null>(null);
  georef = $state<{ active: boolean; pairs: GeorefPair[]; pendingPixel: Pt | null; prefer: 'auto' | 'similarity' }>({
    active: false,
    pairs: [],
    pendingPixel: null,
    prefer: 'auto',
  });
  /** Georeference before the current georeferencing session (for Cancel). */
  private georefBackup: RasterGeoref | null = null;

  /** View CRS: Finland → TM35FIN always; elsewhere UTM with a raster, Web Mercator without (EN-12). */
  crs: CrsInfo = $derived(
    selectViewCrs({
      location: this.raster ? rasterCenter(this.raster) : (this.track?.center() ?? null),
      hasRaster: !!this.raster,
    }),
  );
  credits = $derived(creditsText(this.layers));
  /** "North-up" view rotation: the orienteering map's north (image up) when a raster map is loaded, else 0. */
  mapNorth: number = $derived(this.raster ? rasterNorthRotation(this.raster, this.crs.code) : 0);
  georefFit: FitResult | null = $derived.by(() => {
    if (!this.raster || this.georef.pairs.length === 0) return null;
    return this.fit(this.georef.pairs, this.crs.code);
  });

  exportShortSide = $state(1080);
  exportFps = $state(30);
  bitrateAuto = $state(true);
  bitrateMbps = $state(30);
  /** Export time range (STORY-35). */
  exportRange = $state<ExportRangeSettings>({ ...DEFAULT_EXPORT_RANGE });
  /** Include the map video in the export package. */
  exportMap = $state(true);
  /** Also export each leg change as a real-time (1×) map clip (STORY-46), with this padding (s) around it. */
  exportTransitionClips = $state(false);
  transitionClipPad = $state(3);
  /** Language of texts in the exported videos (component labels, decimal commas) – STORY-40. */
  videoLocale = $state<VideoLocale>(i18n.locale === 'fi' ? 'fi' : 'en');
  /** Data component videos (STORY-32..34). */
  components = $state<ComponentConfig[]>(defaultComponents());
  range: ResolvedRange | null = $derived(
    this.track
      ? resolveRange($state.snapshot(this.exportRange), this.track, this.passings?.map((p) => p.t) ?? null)
      : null,
  );
  exporting = $state(false);
  exportProgress = $state({ done: 0, total: 0, startedAt: 0 });
  exportResult = $state.raw<ExportResultView | null>(null);
  exportError = $state('');

  timeline: Timeline | null = $derived.by(() => this.buildTimeline());

  /**
   * The project's timeline. `transitionOverride` (track s) animates the leg changes over a different time for the
   * real-time transition clips (STORY-46); everything else is as in the main video.
   */
  buildTimeline(transitionOverride?: number): Timeline | null {
    const track = this.track;
    if (!track) return null;
    const course = this.course;
    const passings = this.passings;
    const routes = this.routes;
    const cm =
      this.courseMode && course && passings
        ? {
            course,
            passings,
            camera: $state.snapshot(this.courseCamera),
            routes: $state.snapshot(this.routeDisplay),
            speed: this.speed,
            timeScale: this.timeScale,
            transitionOverride,
            legExtras: (li: number) => routesForLeg(routes, course, li).flatMap((r) => r.points),
          }
        : null;
    return new Timeline(track, this.crs.code, $state.snapshot(this.free), cm, this.mapNorth, this.timeScale);
  }
  /** Everything drawn over the map, shared by preview and export (see lib/render/frameScene.ts). */
  projectScene: ProjectScene | null = $derived(
    this.track
      ? {
          crsCode: this.crs.code,
          track: this.track,
          style: $state.snapshot(this.style),
          course: this.course,
          courseStyle: $state.snapshot(this.courseStyle),
          printScale: this.raster?.printScale ?? null,
          routes: this.routes,
          videoLocale: this.videoLocale,
          timeScale: this.timeScale,
        }
      : null,
  );
  /** True while settings that affect the output must not change. */
  locked = $derived(this.exporting);

  // ---------------- GPX ----------------

  loadGpxText(text: string, fallbackName = 'GPX track'): boolean {
    try {
      const gpx = parseGpx(text);
      new Track(gpx.name || fallbackName, gpx.points); // validate before replacing the current track
      this.gpxName = gpx.name || fallbackName;
      this.gpxEdits = [];
      this.dragEdit = null;
      this.passingOverrides = {};
      this.selectedTrackIndex = null;
      this.editRange = [null, null];
      this.gpx = gpx;
      this.time = 0;
      this.playing = false;
      this.error = '';
      return true;
    } catch (e) {
      this.error = e instanceof GpxError ? errorText(e) : t('msg.gpxRead', { msg: errorText(e) });
      return false;
    }
  }

  /** Routes dropped/chosen files: GPX → track, map images / world files / KMZ → raster map. */
  async loadFiles(files: File[]): Promise<void> {
    const gpx = files.find((f) => /\.gpx$/i.test(f.name) || f.type === 'application/gpx+xml');
    const raster = files.filter(isRasterFile);
    const xml = files.find((f) => /\.xml$/i.test(f.name));
    if (gpx) this.loadGpxText(await gpx.text(), gpx.name.replace(/\.gpx$/i, ''));
    if (raster.length) await this.addRasterFiles(raster);
    if (xml) {
      const text = await xml.text();
      if (isResultListXml(text)) this.importResultsXml(text, xml.name);
      else this.importCourseXml(text);
    }
    if (!gpx && !raster.length && !xml && files.length) {
      this.error = t('msg.notGpxOrMap', { name: files[0].name });
    }
  }

  /** @deprecated use loadFiles */
  async loadFile(file: File): Promise<void> {
    await this.loadFiles([file]);
  }

  async loadSample(): Promise<void> {
    const res = await fetch(`${import.meta.env.BASE_URL}sample.gpx`);
    this.loadGpxText(await res.text(), 'Sample');
  }

  /** Sample project: the sample GPX with a course along it and one route choice (start screen demo). */
  async loadSampleProject(): Promise<void> {
    this.newProject();
    await this.loadSample();
    const tr = this.track;
    if (!tr) return;
    this.projectName = t('msg.sampleName');
    for (const t of [5, 140, 300, 470, 620, 760]) {
      const p = tr.positionAt(t);
      this.courseClick({ lat: p.lat + 0.00006, lon: p.lon });
    }
    const e = tr.positionAt(tr.duration - 3);
    this.courseFinish({ lat: e.lat, lon: e.lon });
    this.routeLeg = 1;
    const m = tr.positionAt(220);
    this.routeDraft = [{ lat: m.lat + 0.0012, lon: m.lon + 0.0008 }];
    this.finishRoute();
    this.clearHistory();
  }

  // ---------------- Project (EN-15 / STORY-38) ----------------

  toast(text: string, kind: Toast['kind'] = 'info'): void {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, text, kind }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 4000);
  }

  setTheme(t: ThemePref): void {
    this.theme = t;
    try {
      localStorage.setItem('omv-theme', t);
    } catch {
      /* private mode */
    }
  }

  get hasContent(): boolean {
    return !!this.gpx || !!this.raster || !!this.course;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo = false;
    this.canRedo = false;
  }

  /** Current visual/export settings (also the content of presets). */
  settings(): ProjectSettings {
    return $state.snapshot({
      free: this.free,
      style: this.style,
      courseStyle: this.courseStyle,
      courseCamera: this.courseCamera,
      routeDisplay: this.routeDisplay,
      courseModeEnabled: this.courseModeEnabled,
      components: this.components,
      exportRange: this.exportRange,
      exportMap: this.exportMap,
      exportTransitionClips: this.exportTransitionClips,
      transitionClipPad: this.transitionClipPad,
      exportShortSide: this.exportShortSide,
      exportFps: this.exportFps,
      bitrateAuto: this.bitrateAuto,
      bitrateMbps: this.bitrateMbps,
      speed: this.speed,
      timeBase: this.timeBase,
      aspect: this.aspect,
      frameCustom: this.frameCustom,
      videoLocale: this.videoLocale,
    }) as ProjectSettings;
  }

  /**
   * Switches the time base (STORY-47): every timed setting is converted with the current speed, so the video does
   * not change. Later speed changes keep the numbers (video seconds keep the on-screen timing, real seconds the race
   * timing).
   */
  setTimeBase(base: TimeBase): void {
    if (base === this.timeBase || this.locked) return;
    const s = convertTimedSettings(this.settings(), this.timeBase, base, this.speed);
    s.timeBase = base;
    this.applySettings(s);
    this.toast(t('time.converted', { unit: t(base === 'real' ? 'time.real' : 'time.video') }), 'ok');
  }

  /** Applies (possibly partial) settings, e.g. from a preset; missing parts keep their current values. */
  applySettings(partial: Partial<ProjectSettings>): void {
    const s = mergeDefaults(this.settings(), partial);
    this.free = s.free;
    this.style = s.style;
    this.courseStyle = s.courseStyle;
    this.courseCamera = s.courseCamera;
    this.routeDisplay = s.routeDisplay;
    this.courseModeEnabled = s.courseModeEnabled;
    this.components = s.components;
    this.exportRange = s.exportRange;
    this.exportMap = s.exportMap;
    this.exportTransitionClips = s.exportTransitionClips;
    this.transitionClipPad = s.transitionClipPad;
    this.exportShortSide = s.exportShortSide;
    this.exportFps = s.exportFps;
    this.bitrateAuto = s.bitrateAuto;
    this.bitrateMbps = s.bitrateMbps;
    this.speed = s.speed;
    this.timeBase = s.timeBase === 'real' ? 'real' : 'video';
    this.aspect = s.aspect;
    this.frameCustom = s.frameCustom;
    this.videoLocale = s.videoLocale === 'fi' ? 'fi' : 'en';
  }

  toDoc(): ProjectDoc {
    const r = this.raster;
    return {
      version: PROJECT_VERSION,
      id: this.projectId,
      name: this.projectName,
      created: this.projectCreated,
      modified: Date.now(),
      gpx: this.gpx ? packGpx(this.gpx, this.gpxName) : null,
      gpxEdits: this.gpxEdits,
      raster: r
        ? {
            name: r.name,
            width: r.width,
            height: r.height,
            georef: r.georef,
            printScale: r.printScale,
            imageType: r.image.type,
          }
        : null,
      layers: $state.snapshot(this.layers) as LayerDesc[],
      course: this.course,
      routes: this.routes,
      passingOverrides: this.passingOverrides,
      matchRadius: this.matchRadius,
      results: this.results,
      settings: this.settings(),
    };
  }

  /** Empties the workspace and starts a new project. */
  newProject(): void {
    this.playing = false;
    this.finishGeoref();
    this.tool = 'none';
    releaseRaster(this.raster);
    this.raster = null;
    this.pendingRaster = null;
    this.pendingWorldFile = null;
    this.gpx = null;
    this.gpxName = '';
    this.gpxEdits = [];
    this.dragEdit = null;
    this.course = null;
    this.routes = [];
    this.passingOverrides = {};
    this.results = null;
    this.pendingResults = null;
    this.resultsError = '';
    this.layers = defaultLayers();
    this.layerHealth = {};
    this.applySettings(defaultSettings());
    // Video texts follow the UI language for new projects (saved projects keep their own).
    this.videoLocale = i18n.locale === 'fi' ? 'fi' : 'en';
    this.exportResult = null;
    this.error = this.rasterError = this.courseError = this.exportError = '';
    this.time = 0;
    this.selectedPointId = null;
    this.selectedTrackIndex = null;
    this.editRange = [null, null];
    this.projectId = newProjectId();
    this.projectName = t('app.untitled');
    this.projectCreated = Date.now();
    this.saveState = 'idle';
    this.lastSaved = null;
    this.clearHistory();
  }

  /** Replaces the workspace with a saved project. */
  async applyDoc(doc: ProjectDoc, image: Blob | null): Promise<void> {
    this.newProject();
    let raster: RasterMap | null = null;
    if (doc.raster && image) {
      const levels = await buildPyramid(image);
      raster = { ...doc.raster, levels, image };
    }
    this.projectId = doc.id;
    this.projectName = doc.name;
    this.projectCreated = doc.created;
    this.gpx = doc.gpx ? unpackGpx(doc.gpx) : null;
    this.gpxName = doc.gpx?.name ?? '';
    this.gpxEdits = doc.gpxEdits;
    this.raster = raster;
    this.layers = raster ? doc.layers : doc.layers.filter((l) => l.kind !== 'raster');
    this.course = doc.course;
    this.routes = doc.routes;
    this.passingOverrides = doc.passingOverrides;
    this.matchRadius = doc.matchRadius;
    this.results = doc.results;
    this.applySettings(doc.settings);
    this.lastSaved = doc.modified;
    this.saveState = 'saved';
    this.clearHistory();
    if (doc.raster && !image) this.toast(t('msg.imageMissing'), 'error');
  }

  togglePlay(): void {
    if (!this.track || this.exporting) return;
    if (!this.playing && this.time >= this.track.duration) this.time = 0;
    this.playing = !this.playing;
  }

  seek(t: number): void {
    if (!this.track) return;
    this.time = Math.min(Math.max(0, t), this.track.duration);
  }

  // ---------------- Frame ----------------

  setAspect(value: number): void {
    this.aspect = value;
    this.frameCustom = null;
  }

  setFrameSize(width: number, height: number): void {
    const w = Math.max(MIN_FRAME.width, Math.round(width));
    const h = Math.max(MIN_FRAME.height, Math.round(height));
    this.frameCustom = { width: w, height: h };
    this.aspect = w / h;
  }

  // ---------------- Raster map ----------------

  async addRasterFiles(files: File[]): Promise<void> {
    if (this.raster && isWorldFileOnly(files)) return this.applyWorldFile(files);
    this.rasterError = '';
    this.rasterLoading = true;
    try {
      const src = await readRasterFiles(files, this.track?.center() ?? null);
      const levels = await buildPyramid(src.image);
      const { width, height } = levels[0];
      const g = src.georef;
      if (g.kind === 'affine' && !(g.crs && isKnownCrs(g.crs))) {
        if (g.crs) this.rasterError = t('msg.crsUnsupported', { crs: g.crs });
        this.pendingRaster = { source: src as PendingRaster['source'], levels };
        return;
      }
      let georef: RasterGeoref;
      if (g.kind === 'corners') {
        const [lon, lat] = g.corners.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4], [0, 0]);
        const crs = selectViewCrs({ location: { lat, lon }, hasRaster: true }).code;
        georef = georefFromCorners(g.corners, width, height, crs, 'kmz');
      } else if (g.kind === 'affine') {
        georef = { crs: g.crs!, affine: g.affine, source: 'world-file' };
      } else {
        georef = placedGeoref(width, height, this.viewCenter, this.crs.code);
      }
      this.setRaster({ name: src.name, width, height, levels, georef, printScale: null, image: src.image });
      if (georef.source === 'placed') this.startGeoref();
    } catch (e) {
      this.rasterError = errorText(e);
    } finally {
      this.rasterLoading = false;
    }
  }

  /** Replaces the loaded raster's georeferencing with a world file (+ optional .prj). */
  async applyWorldFile(files: File[]): Promise<void> {
    const r = this.raster;
    if (!r) return;
    this.rasterError = '';
    this.pendingWorldFile = null;
    try {
      const { affine, crs } = await readWorldFile(files, r.width, r.height, this.track?.center() ?? null);
      if (!(crs && isKnownCrs(crs))) {
        if (crs) this.rasterError = t('msg.crsUnsupported', { crs });
        this.pendingWorldFile = affine;
        return;
      }
      this.setRasterGeoref({ crs, affine, source: 'world-file' });
    } catch (e) {
      this.rasterError = errorText(e);
    }
  }

  /** Completes a pending world file of the loaded raster with the CRS the user chose. */
  resolvePendingWorldFile(code: string): void {
    const affine = this.pendingWorldFile;
    if (!affine) return;
    this.pendingWorldFile = null;
    this.rasterError = '';
    this.setRasterGeoref({ crs: crsFromChoice(code), affine, source: 'world-file' });
  }

  private setRasterGeoref(georef: RasterGeoref): void {
    if (!this.raster) return;
    this.finishGeoref();
    this.raster = { ...this.raster, georef };
  }

  /** Completes a pending world-file raster with the CRS the user chose. */
  resolvePendingRaster(code: string): void {
    const p = this.pendingRaster;
    if (!p) return;
    code = crsFromChoice(code);
    const { width, height } = p.levels[0];
    this.pendingRaster = null;
    this.rasterError = '';
    this.setRaster({
      name: p.source.name,
      width,
      height,
      levels: p.levels,
      georef: { crs: code, affine: p.source.georef.affine, source: 'world-file' },
      printScale: null,
      image: p.source.image,
    });
  }

  private setRaster(r: RasterMap): void {
    if (this.raster) releaseRaster(this.raster);
    this.raster = r;
    const desc: LayerDesc = { id: 'raster', kind: 'raster', title: r.name, visible: true, opacity: 1 };
    const others = this.layers.filter((l) => l.kind !== 'raster');
    this.layers = [...others, desc];
  }

  removeRaster(): void {
    this.cancelGeoref();
    this.pendingWorldFile = null;
    releaseRaster(this.raster);
    this.raster = null;
    this.layers = this.layers.filter((l) => l.kind !== 'raster');
  }

  setPrintScale(scale: number | null): void {
    if (this.raster) this.raster = { ...this.raster, printScale: scale };
  }

  // ---------------- Georeferencing (STORY-14) ----------------

  startGeoref(): void {
    if (!this.raster) return;
    this.georefBackup = this.raster.georef;
    this.georef = { active: true, pairs: [], pendingPixel: null, prefer: this.georef.prefer };
    const d = this.layers.find((l) => l.kind === 'raster');
    if (d && d.opacity > 0.75) d.opacity = 0.6;
  }

  /** Map click during georeferencing: first click picks the image point, second the true position. */
  georefClick(xy: Pt, toPixel: (xy: Pt) => Pt, toLonLat: (xy: Pt) => LatLon): void {
    if (!this.georef.active || !this.raster) return;
    if (!this.georef.pendingPixel) {
      this.georef.pendingPixel = toPixel(xy);
      return;
    }
    this.georef.pairs.push({ pixel: this.georef.pendingPixel, target: toLonLat(xy) });
    this.georef.pendingPixel = null;
    this.applyGeorefFit();
  }

  removeGeorefPair(i: number): void {
    this.georef.pairs.splice(i, 1);
    if (this.georef.pairs.length === 0 && this.georefBackup && this.raster) {
      this.raster = { ...this.raster, georef: this.georefBackup };
    } else this.applyGeorefFit();
  }

  setGeorefPrefer(p: 'auto' | 'similarity'): void {
    this.georef.prefer = p;
    this.applyGeorefFit();
  }

  private fit(pairs: GeorefPair[], crs: string): FitResult {
    const r = this.raster!;
    const base = this.georefBackup && this.georefBackup.crs === crs ? this.georefBackup.affine : r.georef.affine;
    return fitTransform(
      pairs.map((p) => p.pixel),
      pairs.map((p) => forward(crs, p.target)),
      base,
      this.georef.prefer,
    );
  }

  private applyGeorefFit(): void {
    if (!this.raster || this.georef.pairs.length === 0) return;
    const crs = this.crs.code;
    try {
      const { affine } = this.fit($state.snapshot(this.georef.pairs) as GeorefPair[], crs);
      this.raster = { ...this.raster, georef: { crs, affine, source: 'manual' } };
      this.rasterError = '';
    } catch (e) {
      this.rasterError = errorText(e);
    }
  }

  finishGeoref(): void {
    this.georef = { active: false, pairs: [], pendingPixel: null, prefer: this.georef.prefer };
    this.georefBackup = null;
  }

  cancelGeoref(): void {
    if (this.georefBackup && this.raster) this.raster = { ...this.raster, georef: this.georefBackup };
    this.finishGeoref();
  }

  // ---------------- Undo / redo ----------------

  private snapshot(): Snapshot {
    return { course: this.course, gpxEdits: this.gpxEdits, overrides: this.passingOverrides, routes: this.routes };
  }

  private restore(s: Snapshot): void {
    this.course = s.course;
    this.gpxEdits = s.gpxEdits;
    this.passingOverrides = s.overrides;
    this.routes = s.routes;
    this.selectedTrackIndex = null;
    if (this.selectedPointId && !s.course?.points.some((p) => p.id === this.selectedPointId))
      this.selectedPointId = null;
  }

  /** Call before every undoable change. */
  pushHistory(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    this.canUndo = true;
    this.canRedo = false;
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = true;
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    this.canUndo = true;
    this.canRedo = this.redoStack.length > 0;
  }

  /** Switches the export range to custom, starting from the current effective range. */
  private ensureCustomRange(): void {
    if (this.exportRange.mode === 'custom' || !this.range) return;
    const pad = this.exportRange;
    this.exportRange = {
      ...pad,
      mode: 'custom',
      in: this.range.start + pad.padBefore,
      out: this.range.end - pad.padAfter,
    };
  }

  /** Sets the export range start/end to a track time (I / O keys, timeline handles). */
  setRangeIn(t: number): void {
    this.ensureCustomRange();
    this.exportRange.in = Math.max(0, t);
    if (this.exportRange.out <= this.exportRange.in) this.exportRange.out = this.track?.duration ?? t + 1;
  }

  setRangeOut(t: number): void {
    this.ensureCustomRange();
    this.exportRange.out = Math.min(this.track?.duration ?? t, t);
    if (this.exportRange.in >= this.exportRange.out) this.exportRange.in = 0;
  }

  setInspectorTab(tab: InspectorTab): void {
    this.inspectorTab = tab;
    // Tools belong to their tab.
    if (
      (tab !== 'course' && (this.tool === 'course' || this.tool === 'pick-passing')) ||
      (tab !== 'routes' && this.tool === 'route') ||
      (tab !== 'gpx' && this.tool.startsWith('gpx'))
    ) {
      this.setTool('none');
    }
  }

  setTool(t: Tool): void {
    if (t !== 'none' && this.georef.active) this.finishGeoref();
    if (this.tool === 'gpx-redraw' && t !== 'gpx-redraw') this.redrawPath = [];
    if (this.tool === 'route' && t !== 'route') this.routeDraft = [];
    this.tool = this.tool === t ? 'none' : t;
    if (this.tool !== 'pick-passing') this.pickPassingId = null;
  }

  // ---------------- Course (STORY-18/19/20) ----------------

  private setCourse(c: Course | null): void {
    this.pushHistory();
    this.course = c;
  }

  courseClick(at: LatLon): void {
    const c = this.course ?? emptyCourse();
    this.setCourse(appendPoint(c, at));
    const pts = this.course!.points;
    const fi = pts.findIndex((p) => p.kind === 'finish');
    this.selectedPointId = pts[fi >= 0 ? fi - 1 : pts.length - 1].id;
  }

  courseFinish(at?: LatLon): void {
    let c = this.course ?? emptyCourse();
    if (c.points.some((p) => p.kind === 'finish')) return;
    this.pushHistory();
    if (at) c = appendPoint(c, at);
    this.course = finishAtLast(c);
  }

  courseInsert(beforeIndex: number, at: LatLon): void {
    if (!this.course) return;
    this.setCourse(insertControl(this.course, beforeIndex, at));
    this.selectedPointId = this.course!.points[beforeIndex].id;
  }

  /** Live move while dragging; call pushHistory() once when the drag starts. */
  courseMoveLive(id: string, at: LatLon): void {
    if (this.course) this.course = movePoint(this.course, id, at);
  }

  courseRemove(id: string): void {
    if (!this.course) return;
    this.setCourse(removePoint(this.course, id));
    if (this.selectedPointId === id) this.selectedPointId = null;
    const { [id]: _, ...rest } = this.passingOverrides;
    this.passingOverrides = rest;
  }

  courseReorder(id: string, dir: -1 | 1): void {
    if (this.course) this.setCourse(reorderControl(this.course, id, dir));
  }

  courseUpdate(id: string, patch: { code?: string; description?: string }): void {
    if (this.course) this.setCourse(updatePoint(this.course, id, patch));
  }

  clearCourse(): void {
    this.setCourse(null);
    this.passingOverrides = {};
    this.selectedPointId = null;
  }

  importCourseXml(xml: string): void {
    this.courseError = '';
    try {
      const f = parseIofCourseData(xml);
      if (f.mapScale && this.raster && !this.raster.printScale) this.setPrintScale(f.mapScale);
      if (f.courses.length === 1) this.useImportedCourse(f.courses[0]);
      else this.importedCourses = f.courses;
      if (f.skippedControls.length) {
        this.courseError = t('msg.skipped', { n: f.skippedControls.length });
      }
    } catch (e) {
      this.courseError = errorText(e);
    }
  }

  useImportedCourse(c: Course): void {
    this.setCourse(c);
    this.passingOverrides = {};
    this.importedCourses = [];
  }

  // ---------------- Results (STORY-41) ----------------

  /** Imports an IOF XML 2.0/3.0 result list; with several classes the user picks one. */
  importResultsXml(xml: string, source: string): void {
    this.resultsError = '';
    try {
      const file = parseResultList(xml);
      if (file.classes.length === 1) this.chooseResultClass(file, 0, source);
      else this.pendingResults = { file, source };
    } catch (e) {
      this.resultsError = errorText(e);
    }
  }

  /** Imports results from a Navisport link / event id or any URL serving IOF XML. */
  async importResultsUrl(url: string): Promise<void> {
    this.resultsError = '';
    this.resultsLoading = true;
    try {
      const { xml, source } = await fetchResultsFromUrl(url);
      this.importResultsXml(xml, source);
    } catch (e) {
      this.resultsError = errorText(e);
    } finally {
      this.resultsLoading = false;
    }
  }

  /** Searches public Navisport events (by name, around the GPX date when no dates are given). */
  async searchNavisport(name: string): Promise<NavisportEvent[]> {
    this.resultsError = '';
    this.resultsLoading = true;
    try {
      const st = this.track?.startTime;
      const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      const q = st && !name.trim() ? { dateFrom: day(st - 86_400_000), dateTo: day(st + 86_400_000) } : {};
      return await searchEvents({ name, ...q });
    } catch (e) {
      this.resultsError = errorText(e);
      return [];
    } finally {
      this.resultsLoading = false;
    }
  }

  /** Index of the class whose controls best match the course codes (for preselecting the class). */
  bestResultClass(file: ResultFile): number {
    const c = this.course;
    if (!c) return 0;
    let best = 0;
    let bestN = -1;
    file.classes.forEach((cls, i) => {
      const n = mapCourseToResults(c, cls.controls).filter(
        (v) => v !== null && v >= 0 && v < cls.controls.length,
      ).length;
      if (n > bestN) [best, bestN] = [i, n];
    });
    return best;
  }

  chooseResultClass(file: ResultFile, index: number, source: string): void {
    const cls = file.classes[index];
    if (!cls) return;
    this.pendingResults = null;
    this.results = {
      source,
      version: file.version,
      event: file.event,
      date: file.date,
      cls,
      runner: null,
      reference: 'ok',
      clockOffset: 0,
      tzOffsetMin: null,
    };
  }

  /** Chooses the user's own result; suggests the clock offset when a course and GPX are there. */
  setResultRunner(index: number | null): void {
    if (!this.results) return;
    this.results = { ...this.results, runner: index, clockOffset: 0, tzOffsetMin: null };
    if (index !== null) this.autoClockOffset();
  }

  updateResults(patch: Partial<Pick<ResultsDoc, 'reference' | 'clockOffset' | 'tzOffsetMin'>>): void {
    if (this.results) this.results = { ...this.results, ...patch };
  }

  /** Sets the clock offset that best puts the track at the controls at the punch times. */
  autoClockOffset(): void {
    const r = this.results;
    const c = this.course;
    const map = this.resultMap;
    const start = this.resultStartMs;
    if (!r || r.runner === null || !c || !map || start === null || !this.track) return;
    const { offset } = suggestClockOffset(c, map, r.cls.competitors[r.runner], start, this.track);
    this.results = { ...r, clockOffset: offset };
  }

  /** Number of course points that get a passing time from the punches. */
  punchPassingCount(): number {
    return this.punchOverrides()?.size ?? 0;
  }

  private punchOverrides(): Map<string, number> | null {
    const r = this.results;
    const c = this.course;
    const map = this.resultMap;
    const start = this.resultStartMs;
    const tr = this.track;
    if (!r || r.runner === null || !c || !map || start === null || !tr) return null;
    const times = punchTimes(map, r.cls.competitors[r.runner], start, r.clockOffset);
    const base = tr.startTime ?? 0;
    const out = new Map<string, number>();
    let last = -Infinity;
    times.forEach((ms, k) => {
      if (ms === null) return;
      const t = (ms - base) / 1000;
      if (t < 0 || t > tr.duration || t <= last) return;
      last = t;
      out.set(c.points[k].id, ms);
    });
    return out;
  }

  /** Uses the punch times as control passing times (manual overrides; undoable). */
  applyPunchTimes(): number {
    const o = this.punchOverrides();
    if (!o?.size) return 0;
    this.pushHistory();
    this.passingOverrides = Object.fromEntries(o);
    return o.size;
  }

  removeResults(): void {
    this.results = null;
    this.pendingResults = null;
    this.resultsError = '';
  }

  // ---------------- Route choices (STORY-30) ----------------

  routeClick(at: LatLon): void {
    this.routeDraft = [...this.routeDraft, at];
  }

  /** Finishes the drawn route for the selected leg (snapping its ends to the controls when enabled). */
  finishRoute(): void {
    const c = this.course;
    const draft = this.routeDraft;
    this.routeDraft = [];
    if (!c || draft.length < 1) return;
    const a = c.points[this.routeLeg];
    const b = c.points[this.routeLeg + 1];
    if (!a || !b) return;
    const pts = this.routeSnap ? [{ lat: a.lat, lon: a.lon }, ...draft, { lat: b.lat, lon: b.lon }] : draft;
    if (pts.length < 2) return;
    const { label, color } = nextLabelAndColor(routesForLeg(this.routes, c, this.routeLeg));
    this.pushHistory();
    this.routes = [...this.routes, { id: newRouteId(), fromId: a.id, toId: b.id, label, color, points: pts }];
  }

  /** Live vertex move while dragging (call pushHistory() once at drag start). */
  moveRouteVertex(id: string, k: number, at: LatLon): void {
    this.routes = this.routes.map((r) =>
      r.id === id ? { ...r, points: r.points.map((p, i) => (i === k ? at : p)) } : r,
    );
  }

  updateRoute(id: string, patch: Partial<Pick<RouteChoice, 'label' | 'color'>>): void {
    this.pushHistory();
    this.routes = this.routes.map((r) => (r.id === id ? { ...r, ...patch } : r));
  }

  removeRoute(id: string): void {
    this.pushHistory();
    this.routes = this.routes.filter((r) => r.id !== id);
  }

  /** Routes whose leg disappeared after course edits. */
  orphanRouteCount(): number {
    const c = this.course;
    return c ? this.routes.filter((r) => legIndexOf(c, r) < 0).length : this.routes.length;
  }

  removeOrphanRoutes(): void {
    const c = this.course;
    this.pushHistory();
    this.routes = c ? this.routes.filter((r) => legIndexOf(c, r) >= 0) : [];
  }

  // ---------------- Passing times (STORY-22/23) ----------------

  /** Sets a manual passing time (track seconds). Returns an error message or null. */
  setPassing(pointId: string, t: number): string | null {
    const track = this.track;
    const c = this.course;
    if (!track || !c || !this.passings) return translateMsg('msg.noCourseTrack');
    t = Math.min(track.duration, Math.max(0, t));
    const err = validateOverride(c, this.passings, pointId, t);
    if (err) return translateMsg(err);
    this.pushHistory();
    this.passingOverrides = { ...this.passingOverrides, [pointId]: (track.startTime ?? 0) + t * 1000 };
    return null;
  }

  resetPassing(pointId?: string): void {
    this.pushHistory();
    if (!pointId) this.passingOverrides = {};
    else {
      const { [pointId]: _, ...rest } = this.passingOverrides;
      this.passingOverrides = rest;
    }
  }

  isManual(pointId: string): boolean {
    return pointId in this.passingOverrides;
  }

  // ---------------- GPX editing (STORY-21) ----------------

  addGpxEdit(e: GpxEdit | GpxEdit[]): void {
    this.pushHistory();
    this.gpxEdits = [...this.gpxEdits, ...(Array.isArray(e) ? e : [e])];
    this.selectedTrackIndex = null;
  }

  resetGpxEdits(): void {
    this.pushHistory();
    this.gpxEdits = [];
  }

  /** Indices of GPS spikes in the current (edited) track. */
  outliers(): number[] {
    if (!this.gpx) return [];
    return findOutliers(this.gpxEdits.length ? applyEdits(this.gpx.points, this.gpxEdits) : this.gpx.points);
  }

  removeOutliers(): number {
    const o = this.outliers();
    if (o.length) this.addGpxEdit(deleteEditsFor(o));
    return o.length;
  }

  /** Track point index closest in time to t (edited track). */
  indexAtTime(t: number): number {
    const tr = this.track;
    if (!tr) return 0;
    const i = tr.indexAt(t);
    const next = Math.min(tr.points.length - 1, i + 1);
    return Math.abs(tr.points[next].t - t) < Math.abs(tr.points[i].t - t) ? next : i;
  }

  rangeIndices(): [number, number] | null {
    const [a, b] = this.editRange;
    if (a === null || b === null || a === b) return null;
    const i = this.indexAtTime(Math.min(a, b));
    const j = this.indexAtTime(Math.max(a, b));
    return j > i ? [i, j] : null;
  }

  deleteRange(): void {
    const r = this.rangeIndices();
    if (r) this.addGpxEdit({ type: 'delete', from: r[0] + 1, to: r[1] - 1 });
  }

  trimToRange(): void {
    const r = this.rangeIndices();
    if (r) {
      this.addGpxEdit({ type: 'trim', from: r[0], to: r[1] });
      this.time = 0;
      this.editRange = [null, null];
    }
  }

  commitRedraw(): void {
    const r = this.rangeIndices();
    if (r && this.redrawPath.length >= 1) {
      this.addGpxEdit({ type: 'redraw', from: r[0], to: r[1], path: this.redrawPath });
    }
    this.redrawPath = [];
    this.tool = 'gpx';
  }

  editedGpxPoints() {
    return this.gpx ? applyEdits(this.gpx.points, this.gpxEdits) : [];
  }

  // ---------------- Layers (STORY-16/17) ----------------

  addLayer(d: LayerDesc): void {
    const rasterIdx = this.layers.findIndex((l) => l.kind === 'raster');
    const next = [...this.layers];
    next.splice(rasterIdx === -1 ? next.length : rasterIdx, 0, d);
    this.layers = next;
  }

  removeLayer(id: string): void {
    if (id === 'raster') return this.removeRaster();
    this.layers = this.layers.filter((l) => l.id !== id);
  }

  /** Moves a layer up (+1, towards the top) or down (−1). */
  moveLayer(id: string, dir: 1 | -1): void {
    const i = this.layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.layers.length) return;
    const next = [...this.layers];
    [next[i], next[j]] = [next[j], next[i]];
    this.layers = next;
  }
}

export const app = new AppState();
