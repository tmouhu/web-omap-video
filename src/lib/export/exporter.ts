/**
 * Frame-exact offline video export (EN-10, STORY-9): for each frame n, t = start + n·speed/fps,
 * an off-screen OpenLayers map renders the view from `frameStateAt(t)`, we wait until all tiles are
 * loaded (`rendercomplete`), compose the layer canvases + scene overlay into one canvas, and encode
 * it with WebCodecs via mediabunny. Runs faster than real time and does not need a visible tab
 * for encoding (tile loading still uses the main thread).
 *
 * Output is always streamed to a file (never held in memory; a 10 min 1080p video is ~2 GB):
 * the user's chosen file (File System Access API) or a temporary OPFS file that is downloaded afterwards.
 */
import OlMap from 'ol/Map';
import View from 'ol/View';
import {
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';
import type { Timeline } from '../anim/timeline';
import { createOlLayer, type LayerDesc } from '../map/layerModel';
import { registerProjections } from '../map/layers';
import type { RasterMap } from '../raster/rasterMap';
import { drawScene, type SceneStyle } from '../render/scene';
import { frameCount } from './videoSize';

export interface ExportOptions {
  timeline: Timeline;
  width: number;
  height: number;
  /** Size of the preview frame in CSS px: the video shows the same ground area. */
  cssWidth: number;
  cssHeight: number;
  fps: number;
  speed: number;
  startT: number;
  endT: number;
  bitrateMbps: number;
  sceneStyle: SceneStyle;
  /** Layer stack (bottom first) and the project's raster map, same as the preview. */
  layers: LayerDesc[];
  raster: RasterMap | null;
  codec: CodecChoice;
  /** Where the encoded video is streamed (see `openExportTarget`). */
  target: ExportTarget;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Max wait for tiles per frame (ms) before rendering anyway. */
  tileTimeoutMs?: number;
}

export interface ExportResult {
  file: File;
  frames: number;
  seconds: number;
}

export interface ExportTarget {
  writable: FileSystemWritableFileStream;
  getFile(): Promise<File>;
  /** True when written to a user-chosen file; false for a temporary OPFS file to be downloaded. */
  savedToDisk: boolean;
  name: string;
}

type SavePicker = (o: object) => Promise<FileSystemFileHandle>;
const TEMP_PREFIX = 'omv-export-';

/**
 * Opens the export destination BEFORE rendering. Chromium: native "Save as" (null if cancelled).
 * Elsewhere: a temporary file in the origin-private file system (older temp exports are removed).
 */
export async function openExportTarget(
  name: string,
  choice: CodecChoice,
  expectedBytes = 0,
): Promise<ExportTarget | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: 'Video', accept: { [choice.mimeType]: [`.${choice.extension}`] } }],
      });
      return {
        writable: await handle.createWritable(),
        getFile: () => handle.getFile(),
        savedToDisk: true,
        name: handle.name,
      };
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
  }
  const root = await navigator.storage.getDirectory();
  for await (const key of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
    if (key.startsWith(TEMP_PREFIX)) await root.removeEntry(key).catch(() => {});
  }
  const { quota = 0, usage = 0 } = await navigator.storage.estimate();
  if (quota && expectedBytes * 1.15 > quota - usage) {
    const gb = (b: number) => `${(b / 1e9).toFixed(1)} GB`;
    throw new Error(
      `The video (~${gb(expectedBytes)}) does not fit in this browser's temporary storage (${gb(quota - usage)} free). ` +
        'Use Chrome or Edge to save directly to disk, or lower the resolution, bitrate or range.',
    );
  }
  const handle = await root.getFileHandle(`${TEMP_PREFIX}${Date.now()}.${choice.extension}`, { create: true });
  return { writable: await handle.createWritable(), getFile: () => handle.getFile(), savedToDisk: false, name };
}

export interface CodecChoice {
  codec: VideoCodec;
  extension: 'mp4' | 'webm';
  mimeType: string;
}

/** H.264 in MP4 when the browser can encode it (works in every editor); else VP9/AV1/VP8 in WebM. */
export async function chooseCodec(width: number, height: number, bitrate?: number): Promise<CodecChoice | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const quality = bitrate ? new Quality({ bitrate }) : undefined;
  if (await getFirstEncodableVideoCodec(['avc'], { width, height, quality })) {
    return { codec: 'avc', extension: 'mp4', mimeType: 'video/mp4' };
  }
  const c = await getFirstEncodableVideoCodec(['vp9', 'av1', 'vp8'], { width, height, quality });
  return c ? { codec: c, extension: 'webm', mimeType: 'video/webm' } : null;
}

/** Draws all OpenLayers layer canvases of `map` into ctx at `pixelRatio` (OL "export map" pattern). */
export function composeOlCanvases(map: OlMap, ctx: CanvasRenderingContext2D, pixelRatio: number): void {
  const canvases = map.getViewport()?.querySelectorAll<HTMLCanvasElement>('.ol-layers canvas') ?? [];
  for (const canvas of Array.from(canvases)) {
    if (canvas.width === 0) continue;
    const parent = canvas.parentElement as HTMLElement | null;
    const opacity = parent?.style.opacity || canvas.style.opacity;
    ctx.globalAlpha = opacity === '' || opacity === undefined ? 1 : Number(opacity);
    const m = canvas.style.transform.match(/^matrix\(([^(]*)\)$/)?.[1];
    const matrix = m
      ? m.split(',').map(Number)
      : [parseFloat(canvas.style.width) / canvas.width, 0, 0, parseFloat(canvas.style.height) / canvas.height, 0, 0];
    ctx.setTransform(...(matrix.map((v) => v * pixelRatio) as [number, number, number, number, number, number]));
    ctx.drawImage(canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Renders the map now and resolves once no tiles are loading (or after the timeout). */
export function renderComplete(map: OlMap, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      map.un('rendercomplete', done);
      resolve();
    }
    map.on('rendercomplete', done);
    map.renderSync();
  });
}

export async function exportVideo(o: ExportOptions): Promise<ExportResult> {
  const bitrate = Math.round(o.bitrateMbps * 1e6);
  const choice = o.codec;
  registerProjections();
  const pixelRatio = o.width / o.cssWidth;
  const total = frameCount(o.endT - o.startT, o.fps, o.speed);

  // Off-screen (but laid out) OL map with the same CSS size as the preview frame.
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${o.cssWidth}px`,
    height: `${o.cssHeight}px`,
  });
  document.body.appendChild(host);
  const map = new OlMap({
    target: host,
    layers: o.layers
      .filter((d) => d.visible)
      .map((d) => createOlLayer(d, o.timeline.crsCode, o.raster))
      .filter((l) => l !== null),
    controls: [],
    interactions: [],
    pixelRatio,
    view: new View({ projection: o.timeline.crsCode, constrainResolution: false, smoothResolutionConstraint: false }),
  });

  const canvas = document.createElement('canvas');
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const target = new StreamTarget(o.target.writable as unknown as WritableStream, { chunked: true });
  const format = choice.extension === 'mp4' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec: choice.codec,
    quality: new Quality({ bitrate }),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: o.fps });

  try {
    await output.start();
    for (let n = 0; n < total; n++) {
      if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const t = Math.min(o.endT, o.startT + (n * o.speed) / o.fps);
      const fs = o.timeline.frameStateAt(t, o.cssHeight);
      const view = map.getView();
      view.setCenter(fs.view.center);
      view.setResolution(fs.view.resolution);
      view.setRotation(fs.view.rotation);
      await renderComplete(map, o.tileTimeoutMs ?? 15000);
      ctx.fillStyle = '#ece8df';
      ctx.fillRect(0, 0, o.width, o.height);
      composeOlCanvases(map, ctx, pixelRatio);
      drawScene(ctx, o.width, o.height, pixelRatio, fs.view, {
        crsCode: o.timeline.crsCode,
        track: o.timeline.track,
        time: t,
        heading: fs.gridHeading,
        style: o.sceneStyle,
      });
      await source.add(n / o.fps, 1 / o.fps);
      o.onProgress?.(n + 1, total);
    }
    source.close();
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    await o.target.writable.abort().catch(() => {});
    throw e;
  } finally {
    map.setTarget(undefined);
    host.remove();
  }
  return { file: await o.target.getFile(), frames: total, seconds: total / o.fps };
}

/** Starts a regular browser download of a (possibly disk-backed) file. */
export function downloadFile(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function videoFileName(track: string, fps: number, w: number, h: number, ext: string, speed: number): string {
  const safe = track.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'track';
  return `${safe}_map${speed !== 1 ? `_${speed}x` : ''}_${fps}fps_${w}x${h}.${ext}`;
}
