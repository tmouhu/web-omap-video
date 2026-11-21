/** Global app state (Svelte 5 runes). Heavy objects use $state.raw (not deeply proxied). */
import { DEFAULT_FREE_MODE, Timeline, type FreeModeSettings } from '../lib/anim/timeline';
import { forward, isKnownCrs, selectViewCrs, utmCrs, type CrsInfo } from '../lib/geo/crs';
import type { LatLon } from '../lib/geo/geo';
import { GpxError, parseGpx } from '../lib/gpx/gpx';
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

export interface ExportResultView {
  url: string;
  file: File;
  name: string;
  savedToDisk: boolean;
  codec: string;
  frames: number;
  seconds: number;
  elapsedMs: number;
}

export interface GeorefPair {
  pixel: Pt;
  /** True position (WGS84), so pairs survive view-CRS changes. */
  target: LatLon;
}

/** A world-file raster whose CRS could not be determined; waits for the user's choice. */
export interface PendingRaster {
  source: RasterSource & { georef: { kind: 'affine' } };
  levels: ImageBitmap[];
}

class AppState {
  track = $state.raw<Track | null>(null);
  error = $state('');
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
  exportFromStart = $state(true);
  exporting = $state(false);
  exportProgress = $state({ done: 0, total: 0, startedAt: 0 });
  exportResult = $state.raw<ExportResultView | null>(null);
  exportError = $state('');

  timeline = $derived(this.track ? new Timeline(this.track, this.crs.code, $state.snapshot(this.free)) : null);
  /** True while settings that affect the output must not change. */
  locked = $derived(this.exporting);

  // ---------------- GPX ----------------

  loadGpxText(text: string, fallbackName = 'GPX track'): boolean {
    try {
      const gpx = parseGpx(text);
      this.track = new Track(gpx.name || fallbackName, gpx.points);
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
    if (gpx) this.loadGpxText(await gpx.text(), gpx.name.replace(/\.gpx$/i, ''));
    if (raster.length) await this.addRasterFiles(raster);
    if (!gpx && !raster.length && files.length) {
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
