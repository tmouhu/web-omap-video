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
import { defaultComponents, type ComponentConfig } from '../lib/components/components';
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
import { fitTransform, type FitResult, type Pt } from '../lib/raster/affine';
import { isRasterFile, readRasterFiles, type RasterSource } from '../lib/raster/load';
import {
  buildPyramid,
  georefFromCorners,
  placedGeoref,
  rasterCenter,
  releaseRaster,
  type RasterGeoref,
  type RasterMap,
} from '../lib/raster/rasterMap';
import { DEFAULT_COURSE_STYLE, type CourseStyle } from '../lib/render/overprint';
import { DEFAULT_SCENE_STYLE, type SceneStyle } from '../lib/render/scene';
import { Track } from '../lib/track/track';

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

export type InspectorTab = 'map' | 'course' | 'gpx' | 'video';

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

class AppState {
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

  timeline: Timeline | null = $derived.by(() => {
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
            legExtras: (li: number) => routesForLeg(routes, course, li).flatMap((r) => r.points),
          }
        : null;
    return new Timeline(track, this.crs.code, $state.snapshot(this.free), cm);
  });
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
      this.error = e instanceof GpxError ? e.message : `Could not read the GPX file: ${(e as Error).message}`;
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
    if (xml) this.importCourseXml(await xml.text());
    if (!gpx && !raster.length && !xml && files.length) {
      this.error = `"${files[0].name}" is not a GPX file or a map image.`;
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
    this.rasterError = '';
    this.rasterLoading = true;
    try {
      const src = await readRasterFiles(files, this.track?.center() ?? null);
      const levels = await buildPyramid(src.image);
      const { width, height } = levels[0];
      const g = src.georef;
      if (g.kind === 'affine' && !(g.crs && isKnownCrs(g.crs))) {
        if (g.crs) this.rasterError = `The map's coordinate system ${g.crs} is not supported yet. Choose one below.`;
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
      this.setRaster({ name: src.name, width, height, levels, georef, printScale: null });
      if (georef.source === 'placed') this.startGeoref();
    } catch (e) {
      this.rasterError = (e as Error).message;
    } finally {
      this.rasterLoading = false;
    }
  }

  /** Completes a pending world-file raster with the CRS the user chose. */
  resolvePendingRaster(code: string): void {
    const p = this.pendingRaster;
    if (!p) return;
    if (code.startsWith('UTM')) code = utmCrs({ lat: 10, lon: +code.slice(3) * 6 - 183 }).code;
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
      this.rasterError = (e as Error).message;
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
      (tab !== 'course' && (this.tool === 'course' || this.tool === 'pick-passing' || this.tool === 'route')) ||
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
        this.courseError = `${f.skippedControls.length} control(s) without coordinates were skipped.`;
      }
    } catch (e) {
      this.courseError = (e as Error).message;
    }
  }

  useImportedCourse(c: Course): void {
    this.setCourse(c);
    this.passingOverrides = {};
    this.importedCourses = [];
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
    if (!track || !c || !this.passings) return 'No course or track.';
    t = Math.min(track.duration, Math.max(0, t));
    const err = validateOverride(c, this.passings, pointId, t);
    if (err) return err;
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
