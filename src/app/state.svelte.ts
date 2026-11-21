/** Global app state (Svelte 5 runes). Heavy objects use $state.raw (not deeply proxied). */
import { DEFAULT_FREE_MODE, Timeline, type FreeModeSettings } from '../lib/anim/timeline';
import { selectViewCrs, TM35FIN, type CrsInfo } from '../lib/geo/crs';
import { GpxError, parseGpx } from '../lib/gpx/gpx';
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

class AppState {
  track = $state.raw<Track | null>(null);
  error = $state('');
  crs = $state.raw<CrsInfo>(TM35FIN);
  time = $state(0);
  playing = $state(false);
  speed = $state(1);
  free = $state<FreeModeSettings>({ ...DEFAULT_FREE_MODE });
  style = $state<SceneStyle>({ ...DEFAULT_SCENE_STYLE });
  aspect = $state(16 / 9);
  /** Preview frame size in CSS px (measured by MapStage). */
  frame = $state({ width: 0, height: 0 });

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

  loadGpxText(text: string, fallbackName = 'GPX track'): boolean {
    try {
      const gpx = parseGpx(text);
      const track = new Track(gpx.name || fallbackName, gpx.points);
      this.crs = selectViewCrs({ location: track.center(), hasRaster: false });
      this.track = track;
      this.time = 0;
      this.playing = false;
      this.error = '';
      return true;
    } catch (e) {
      this.error = e instanceof GpxError ? e.message : `Could not read the GPX file: ${(e as Error).message}`;
      return false;
    }
  }

  async loadFile(file: File): Promise<void> {
    if (!/\.gpx$/i.test(file.name) && file.type !== 'application/gpx+xml') {
      this.error = `"${file.name}" is not a GPX file.`;
      return;
    }
    this.loadGpxText(await file.text(), file.name.replace(/\.gpx$/i, ''));
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
}

export const app = new AppState();
