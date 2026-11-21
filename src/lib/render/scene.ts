/**
 * Vector scene and overlays drawn on a 2D canvas on top of the OpenLayers layers (EN-2).
 * One function draws both the preview overlay and each export frame, so they look identical.
 * Sizes are given in CSS px and multiplied by `pixelRatio`.
 */
import { forward, gridConvergence, inverse, pointScale } from '../geo/crs';
import type { Course } from '../course/course';
import { drawOverprint, type CourseStyle } from './overprint';
import { toRad } from '../geo/geo';
import type { ViewState } from '../anim/timeline';
import type { Track } from '../track/track';

/**
 * The video frame shows only the map, the route and the runner (product decision, Nov 2026):
 * no info box, no scale bar and no attribution in the frame. Credits are shown in the UI instead.
 */
export interface SceneStyle {
  showNorthArrow: boolean;
}

export const DEFAULT_SCENE_STYLE: SceneStyle = { showNorthArrow: true };

export interface SceneInput {
  crsCode: string;
  track: Track | null;
  /** Playback time (s), or null to hide the runner. */
  time: number | null;
  /** Grid heading (deg) for the arrow; null draws a dot. */
  heading: number | null;
  style: SceneStyle;
  /** Course overprint, drawn between the map and the track. */
  course?: {
    course: Course;
    style: CourseStyle;
    printScale: number | null;
    highlightLeg: number | null;
    selectedId?: string | null;
  } | null;
}

const COLORS = {
  trackFull: 'rgba(25, 105, 255, 0.75)',
  trackHalo: 'rgba(255, 255, 255, 0.55)',
  travelled: 'rgba(255, 82, 30, 0.95)',
  halo: 'rgba(255, 255, 255, 0.9)',
  arrow: '#ff3d00',
};

const projCache = new WeakMap<Track, Map<string, Float64Array>>();

/** Track coordinates projected once per (track, CRS). */
export function projectedTrack(track: Track, code: string): Float64Array {
  let byCrs = projCache.get(track);
  if (!byCrs) projCache.set(track, (byCrs = new Map()));
  let arr = byCrs.get(code);
  if (!arr) {
    arr = new Float64Array(track.points.length * 2);
    track.points.forEach((p, i) => {
      const [x, y] = forward(code, p);
      arr![i * 2] = x;
      arr![i * 2 + 1] = y;
    });
    byCrs.set(code, arr);
  }
  return arr;
}

/** Maps view-CRS coordinates to canvas pixels for a view (OL rotation convention). */
export function makeTransform(view: ViewState, width: number, height: number, pixelRatio: number) {
  const k = pixelRatio / view.resolution;
  const c = Math.cos(view.rotation);
  const s = Math.sin(view.rotation);
  const [cx, cy] = view.center;
  return (x: number, y: number): [number, number] => {
    const dx = (x - cx) * k;
    const dy = -(y - cy) * k;
    return [width / 2 + dx * c - dy * s, height / 2 + dx * s + dy * c];
  };
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelRatio: number,
  view: ViewState,
  scene: SceneInput,
): void {
  const pr = pixelRatio;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const T = makeTransform(view, width, height, pr);
  const { track, time } = scene;

  if (scene.course) {
    const groundResolution = view.resolution / pointScale(scene.crsCode, inverse(scene.crsCode, view.center));
    drawOverprint(ctx, T, pr, { crsCode: scene.crsCode, groundResolution, ...scene.course });
  }

  if (track) {
    const xy = projectedTrack(track, scene.crsCode);
    const path = (from: number, to: number, end?: [number, number]) => {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const [px, py] = T(xy[i * 2], xy[i * 2 + 1]);
        if (i === from) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (end) ctx.lineTo(...T(end[0], end[1]));
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    path(0, track.points.length - 1);
    ctx.strokeStyle = COLORS.trackHalo;
    ctx.lineWidth = 5.5 * pr;
    ctx.stroke();
    ctx.strokeStyle = COLORS.trackFull;
    ctx.lineWidth = 3 * pr;
    ctx.stroke();

    if (time !== null) {
      const pos = track.positionAt(time);
      const posXY = forward(scene.crsCode, pos);
      path(0, track.indexAt(time), posXY);
      ctx.strokeStyle = COLORS.halo;
      ctx.lineWidth = 6.5 * pr;
      ctx.stroke();
      ctx.strokeStyle = COLORS.travelled;
      ctx.lineWidth = 4 * pr;
      ctx.stroke();
      drawRunner(ctx, ...T(posXY[0], posXY[1]), scene.heading, view.rotation, pr);
    }
  }
  ctx.restore();
  drawOverlays(ctx, width, height, pr, view, scene);
}

/** Navigation arrow (STORY-28) pointing along the grid heading, relative to the map rotation. */
function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number | null,
  rotation: number,
  pr: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4 * pr;
  if (heading === null) {
    ctx.beginPath();
    ctx.arc(0, 0, 8 * pr, 0, Math.PI * 2);
  } else {
    ctx.rotate(toRad(heading) + rotation);
    const s = 13 * pr;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(0.78 * s, 0.85 * s);
    ctx.lineTo(0, 0.42 * s);
    ctx.lineTo(-0.78 * s, 0.85 * s);
    ctx.closePath();
  }
  ctx.fillStyle = COLORS.arrow;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.2 * pr;
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  pr: number,
  view: ViewState,
  scene: SceneInput,
) {
  if (!scene.style.showNorthArrow) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pad = 12 * pr;
  const centre = inverse(scene.crsCode, view.center);
  // Points to true north: grid rotation + convergence at the view centre.
  const r = 17 * pr;
  ctx.translate(width - pad - r, pad + r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fill();
  ctx.rotate(view.rotation + toRad(gridConvergence(scene.crsCode, centre)));
  ctx.beginPath();
  ctx.moveTo(0, -12 * pr);
  ctx.lineTo(5.5 * pr, 4 * pr);
  ctx.lineTo(0, 1 * pr);
  ctx.lineTo(-5.5 * pr, 4 * pr);
  ctx.closePath();
  ctx.fillStyle = '#d32f2f';
  ctx.fill();
  ctx.fillStyle = '#1b1f24';
  ctx.font = `700 ${Math.round(9 * pr)}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, 10 * pr);
  ctx.restore();
}
