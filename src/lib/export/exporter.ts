import { UserError } from '../i18n/core';
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
import { composeOlCanvases } from '../map/compose';
import { registerProjections } from '../map/layers';
import type { RasterMap } from '../raster/rasterMap';
import { drawScene } from '../render/scene';
import { sceneForFrame, type ProjectScene } from '../render/frameScene';
import { frameCount } from './videoSize';
import { drawComponent, type ComponentConfig, type ComponentKind } from '../components/components';

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
  /** Project data drawn on top of the map (track, course, routes, style). */
  scene: ProjectScene;
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
    throw new UserError('err.tempTooSmall', { size: gb(expectedBytes), free: gb(quota - usage) });
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

/** One output of a package export: the map video or a data component video. */
export interface OutputSpec {
  id: string;
  /** 'map' or a component kind. */
  kind: 'map' | ComponentKind;
  width: number;
  height: number;
  bitrateMbps: number;
  codec: CodecChoice;
  target: ExportTarget;
  /** Component configuration (component outputs only). */
  component?: ComponentConfig;
}

export interface PackageOptions extends Omit<ExportOptions, 'width' | 'height' | 'bitrateMbps' | 'codec' | 'target'> {
  outputs: OutputSpec[];
  /** Origin for elapsed time/distance components and the course passing times. */
  origin: number;
  passings: number[] | null;
}

export interface PackageResult {
  files: { id: string; file: File }[];
  frames: number;
  seconds: number;
}

/**
 * Frame-exact export of several videos in ONE pass over time: each frame's state is computed once and drawn into
 * every output, so all files share the same range, frame rate, frame count and timestamps (STORY-32/36).
 */
export async function exportPackage(o: PackageOptions): Promise<PackageResult> {
  registerProjections();
  const total = frameCount(o.endT - o.startT, o.fps, o.speed);
  const mapOut = o.outputs.find((x) => x.kind === 'map');
  const pixelRatio = mapOut ? mapOut.width / o.cssWidth : 1;

  let host: HTMLDivElement | null = null;
  let map: OlMap | null = null;
  if (mapOut) {
    // Off-screen (but laid out) OL map with the same CSS size as the preview frame.
    host = document.createElement('div');
    Object.assign(host.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: `${o.cssWidth}px`,
      height: `${o.cssHeight}px`,
    });
    document.body.appendChild(host);
    map = new OlMap({
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
  }

  const lanes = o.outputs.map((spec) => {
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const target = new StreamTarget(spec.target.writable as unknown as WritableStream, { chunked: true });
    const format = spec.codec.extension === 'mp4' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat();
    const output = new Output({ format, target });
    const source = new CanvasSource(canvas, {
      codec: spec.codec.codec,
      quality: new Quality({ bitrate: Math.round(spec.bitrateMbps * 1e6) }),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(source, { frameRate: o.fps });
    return { spec, canvas, ctx, output, source };
  });

  try {
    await Promise.all(lanes.map((l) => l.output.start()));
    for (let n = 0; n < total; n++) {
      if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const t = Math.min(o.endT, o.startT + (n * o.speed) / o.fps);
      const fs = o.timeline.frameStateAt(t, { width: o.cssWidth, height: o.cssHeight });
      if (map) {
        const view = map.getView();
        view.setCenter(fs.view.center);
        view.setResolution(fs.view.resolution);
        view.setRotation(fs.view.rotation);
        await renderComplete(map, o.tileTimeoutMs ?? 15000);
      }
      const data = {
        track: o.timeline.track,
        t,
        rangeStart: o.startT,
        rangeEnd: o.endT,
        origin: o.origin,
        passings: o.passings,
        locale: o.scene.videoLocale,
      };
      for (const l of lanes) {
        if (l.spec.kind === 'map') {
          l.ctx.fillStyle = '#ece8df';
          l.ctx.fillRect(0, 0, l.spec.width, l.spec.height);
          composeOlCanvases(map!, l.ctx, pixelRatio);
          drawScene(l.ctx, l.spec.width, l.spec.height, pixelRatio, fs.view, sceneForFrame(fs, o.scene));
        } else if (l.spec.component) {
          drawComponent(l.ctx, l.spec.component, data);
        }
      }
      await Promise.all(lanes.map((l) => l.source.add(n / o.fps, 1 / o.fps)));
      o.onProgress?.(n + 1, total);
    }
    lanes.forEach((l) => l.source.close());
    await Promise.all(lanes.map((l) => l.output.finalize()));
  } catch (e) {
    await Promise.all(
      lanes.map(async (l) => {
        await l.output.cancel().catch(() => {});
        await l.spec.target.writable.abort().catch(() => {});
      }),
    );
    throw e;
  } finally {
    map?.setTarget(undefined);
    host?.remove();
  }
  const files = await Promise.all(lanes.map(async (l) => ({ id: l.spec.id, file: await l.spec.target.getFile() })));
  return { files, frames: total, seconds: total / o.fps };
}

/** Single map video (kept for callers that only need the map). */
export async function exportVideo(o: ExportOptions): Promise<ExportResult> {
  const r = await exportPackage({
    ...o,
    origin: o.startT,
    passings: null,
    outputs: [
      {
        id: 'map',
        kind: 'map',
        width: o.width,
        height: o.height,
        bitrateMbps: o.bitrateMbps,
        codec: o.codec,
        target: o.target,
      },
    ],
  });
  return { file: r.files[0].file, frames: r.frames, seconds: r.seconds };
}

type DirPicker = (o?: object) => Promise<FileSystemDirectoryHandle>;

/**
 * Opens destinations for several files BEFORE rendering: one folder picked once (File System Access API),
 * else temporary OPFS files that are downloaded afterwards. Returns null if the folder dialog was cancelled.
 */
export async function openPackageTargets(
  files: { name: string; codec: CodecChoice; bytes: number }[],
): Promise<{ targets: ExportTarget[]; folder: FileSystemDirectoryHandle | null } | null> {
  if (files.length === 1) {
    const t = await openExportTarget(files[0].name, files[0].codec, files[0].bytes);
    return t ? { targets: [t], folder: null } : null;
  }
  const dirPicker = (window as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker;
  if (dirPicker) {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await dirPicker({ mode: 'readwrite', id: 'omv-export' });
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
    const targets = await Promise.all(
      files.map(async (f) => {
        const h = await dir.getFileHandle(f.name, { create: true });
        return { writable: await h.createWritable(), getFile: () => h.getFile(), savedToDisk: true, name: f.name };
      }),
    );
    return { targets, folder: dir };
  }
  const root = await navigator.storage.getDirectory();
  for await (const key of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
    if (key.startsWith(TEMP_PREFIX)) await root.removeEntry(key).catch(() => {});
  }
  const need = files.reduce((s, f) => s + f.bytes, 0);
  const { quota = 0, usage = 0 } = await navigator.storage.estimate();
  if (quota && need * 1.15 > quota - usage) {
    throw new UserError('err.tempTooSmallMany', { size: `${(need / 1e9).toFixed(1)} GB` });
  }
  const stamp = Date.now();
  const targets = await Promise.all(
    files.map(async (f, i) => {
      const h = await root.getFileHandle(`${TEMP_PREFIX}${stamp}-${i}.${f.codec.extension}`, { create: true });
      return { writable: await h.createWritable(), getFile: () => h.getFile(), savedToDisk: false, name: f.name };
    }),
  );
  return { targets, folder: null };
}

/** Writes a small text file into the chosen export folder (export.json). */
export async function writeToFolder(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(text);
  await w.close();
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

export function videoFileName(
  track: string,
  fps: number,
  w: number,
  h: number,
  ext: string,
  speed: number,
  part = 'map',
): string {
  const safe = track.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'track';
  return `${safe}_${part}${speed !== 1 ? `_${speed}x` : ''}_${fps}fps_${w}x${h}.${ext}`;
}
