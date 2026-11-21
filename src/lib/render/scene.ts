/**
 * Vector scene and overlays drawn on a 2D canvas on top of the OpenLayers layers (EN-2).
 * One function draws both the preview overlay and each export frame, so they look identical.
 * Sizes are given in CSS px and multiplied by `pixelRatio`.
 */
import { forward, gridConvergence, inverse, pointScale } from '../geo/crs';
import type { Course } from '../course/course';
import { drawOverprint, type CourseStyle } from './overprint';
import { toRad, type LatLon } from '../geo/geo';
import type { ViewState } from '../anim/timeline';
import type { Track } from '../track/track';

/** GPX tail and runner style (STORY-28/29). Sizes in CSS px. */
export interface TrackStyle {
  /** Tail: the last N seconds, everything since the leg started, or the whole route so far. */
  tailMode: 'seconds' | 'leg' | 'all';
  tailSeconds: number;
  colorMode: 'single' | 'pace';
  color: string;
  width: number;
  /** Oldest part of the tail fades out. */
  fade: boolean;
  /** Route not yet run (spoiler) – off by default. */
  showFuture: boolean;
  /** Route run before the tail, as a thin faint line. */
  showTravelled: boolean;
  arrowSize: number;
  arrowColor: string;
}

export const DEFAULT_TRACK_STYLE: TrackStyle = {
  tailMode: 'seconds',
  tailSeconds: 60,
  colorMode: 'pace',
  color: '#ff3d00',
  width: 5.5,
  fade: true,
  showFuture: false,
  showTravelled: true,
  arrowSize: 13,
  arrowColor: '#ff3d00',
};

/**
 * The video frame shows only the map, the course, the route and the runner (product decision, Nov 2026):
 * no info box, no scale bar and no attribution in the frame. Credits are shown in the UI instead.
 */
export interface SceneStyle {
  showNorthArrow: boolean;
  track: TrackStyle;
}

export const DEFAULT_SCENE_STYLE: SceneStyle = { showNorthArrow: true, track: { ...DEFAULT_TRACK_STYLE } };

export interface SceneRoute {
  points: LatLon[];
  color: string;
  label: string;
  lengthText: string;
}

export interface SceneInput {
  crsCode: string;
  track: Track | null;
  /** Playback time (s), or null to hide the runner. */
  time: number | null;
  /** Grid heading (deg) for the arrow; null draws a dot. */
  heading: number | null;
  style: SceneStyle;
  /** Course mode: start time of the shown leg (for "leg" tails). */
  legStartT?: number | null;
  /** Course overprint, drawn between the map and the track. */
  course?: {
    course: Course;
    style: CourseStyle;
    printScale: number | null;
    highlightLeg: number | null;
    selectedId?: string | null;
  } | null;
  /** Route choices of the shown leg with their current opacity (STORY-31). */
  routes?: { items: SceneRoute[]; alpha: number } | null;
}

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

const paceCache = new WeakMap<Track, { pace: (number | null)[]; median: number }>();

/** Pace (s/km, 10 s window) at every track point, and the median moving pace. */
export function paceSeries(track: Track): { pace: (number | null)[]; median: number } {
  let c = paceCache.get(track);
  if (!c) {
    const pace = track.points.map((p) => track.paceAt(p.t));
    const moving = pace.filter((x): x is number => x !== null).sort((a, b) => a - b);
    c = { pace, median: moving.length ? moving[Math.floor(moving.length / 2)] : 360 };
    paceCache.set(track, c);
  }
  return c;
}

/** Pace colour relative to the median: fast → green, typical → yellow, slow/stopped → red. */
export function paceColor(pace: number | null, median: number): string {
  if (pace === null) return 'rgb(215, 25, 28)';
  const x = Math.min(1, Math.max(0, (pace / median - 0.85) / (1.45 - 0.85)));
  // green (26,150,65) → yellow (250,200,30) → red (215,25,28)
  const g = [26, 150, 65];
  const y = [250, 200, 30];
  const r = [215, 25, 28];
  const mix = (a: number[], b: number[], f: number) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
  const c = x < 0.5 ? mix(g, y, x * 2) : mix(y, r, (x - 0.5) * 2);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
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
  if (scene.routes && scene.routes.alpha > 0.001) drawRoutes(ctx, T, pr, scene.crsCode, scene.routes, width, height);
  if (track) drawTrack(ctx, T, pr, scene, track, time);
  ctx.restore();
  drawOverlays(ctx, width, height, pr, view, scene);
}

function drawTrack(
  ctx: CanvasRenderingContext2D,
  T: (x: number, y: number) => [number, number],
  pr: number,
  scene: SceneInput,
  track: Track,
  time: number | null,
) {
  const st = scene.style.track;
  const xy = projectedTrack(track, scene.crsCode);
  const n = track.points.length;
  const px = (i: number) => T(xy[i * 2], xy[i * 2 + 1]);
  const polyline = (from: number, to: number, head?: [number, number], tail?: [number, number]) => {
    ctx.beginPath();
    if (head) ctx.moveTo(...head);
    for (let i = from; i <= to; i++) {
      const p = px(i);
      if (i === from && !head) ctx.moveTo(...p);
      else ctx.lineTo(...p);
    }
    if (tail) ctx.lineTo(...tail);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const now = time ?? track.duration;
  const iNow = track.indexAt(now);
  const posXY = T(...forward(scene.crsCode, track.positionAt(now)));

  if (st.showFuture || time === null) {
    polyline(Math.min(iNow + 1, n - 1), n - 1, time === null ? undefined : posXY);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4.5 * pr;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(25, 105, 255, 0.6)';
    ctx.lineWidth = 2.5 * pr;
    ctx.stroke();
  }
  if (time === null) return;

  // Tail start time.
  let t0 = 0;
  if (st.tailMode === 'seconds') t0 = Math.max(0, now - st.tailSeconds);
  else if (st.tailMode === 'leg') t0 = Math.max(0, Math.min(now, scene.legStartT ?? 0));
  const i0 = track.indexAt(t0);
  const startXY = T(...forward(scene.crsCode, track.positionAt(t0)));

  if (st.showTravelled && t0 > 0) {
    polyline(0, i0, undefined, startXY);
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.35)';
    ctx.lineWidth = 2 * pr;
    ctx.stroke();
  }

  // Dark edge + white halo under the whole tail: readable on every map colour (greens, yellows, black).
  polyline(i0 + 1, iNow, startXY, posXY);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = (st.width + 5) * pr;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = (st.width + 2.5) * pr;
  ctx.stroke();

  // Coloured tail, segment by segment (pace colours and fade).
  const pts: [number, number][] = [startXY];
  const idx: number[] = [i0];
  for (let i = i0 + 1; i <= iNow; i++) {
    pts.push(px(i));
    idx.push(i);
  }
  pts.push(posXY);
  idx.push(iNow);
  const { pace, median } = st.colorMode === 'pace' ? paceSeries(track) : { pace: [], median: 1 };
  const span = Math.max(1e-6, now - t0);
  ctx.lineWidth = st.width * pr;
  for (let k = 1; k < pts.length; k++) {
    const i = idx[k];
    const tk = track.points[Math.min(i, n - 1)].t;
    ctx.globalAlpha = st.fade ? Math.min(1, 0.15 + (1.6 * Math.max(0, tk - t0)) / span) : 1;
    ctx.strokeStyle = st.colorMode === 'pace' ? paceColor(pace[i] ?? null, median) : st.color;
    ctx.beginPath();
    ctx.moveTo(...pts[k - 1]);
    ctx.lineTo(...pts[k]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawRunner(ctx, posXY[0], posXY[1], scene.heading, pr, st, T);
}

/** Navigation arrow (STORY-28) pointing along the grid heading, relative to the map rotation. */
function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number | null,
  pr: number,
  st: TrackStyle,
  T: (x: number, y: number) => [number, number],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4 * pr;
  const s = st.arrowSize * pr;
  if (heading === null) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
  } else {
    // Screen angle of the grid heading: transform a unit step along the heading.
    const o = T(0, 0);
    const d = T(Math.sin(toRad(heading)) * 1000, Math.cos(toRad(heading)) * 1000);
    ctx.rotate(Math.atan2(d[0] - o[0], -(d[1] - o[1])));
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(0.78 * s, 0.85 * s);
    ctx.lineTo(0, 0.42 * s);
    ctx.lineTo(-0.78 * s, 0.85 * s);
    ctx.closePath();
  }
  ctx.fillStyle = st.arrowColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.2 * pr;
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Route choices with halo and upright length labels placed to avoid each other (STORY-31). */
function drawRoutes(
  ctx: CanvasRenderingContext2D,
  T: (x: number, y: number) => [number, number],
  pr: number,
  crs: string,
  routes: { items: SceneRoute[]; alpha: number },
  width: number,
  height: number,
) {
  const screen = routes.items.map((r) => r.points.map((p) => T(...forward(crs, p))));
  ctx.save();
  ctx.globalAlpha = routes.alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  screen.forEach((pts, k) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 7 * pr;
    ctx.stroke();
    ctx.strokeStyle = routes.items[k].color;
    ctx.lineWidth = 4 * pr;
    ctx.setLineDash([10 * pr, 6 * pr]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Labels.
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  ctx.font = `700 ${13 * pr}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  screen.forEach((pts, k) => {
    if (pts.length < 2) return;
    const r = routes.items[k];
    const text = `${r.label} · ${r.lengthText}`;
    const w = ctx.measureText(text).width + 14 * pr;
    const h = 22 * pr;
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (f: number): [number, number] => {
      const d = f * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const g = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * g, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * g];
    };
    let best: [number, number] = at(0.5);
    for (const f of [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8]) {
      const [x, y] = at(f);
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      const inside = box.x > 2 && box.y > 2 && box.x + w < width - 2 && box.y + h < height - 2;
      const overlaps = placed.some(
        (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
      );
      if (inside && !overlaps) {
        best = [x, y];
        break;
      }
    }
    placed.push({ x: best[0] - w / 2, y: best[1] - h / 2, w, h });
    ctx.beginPath();
    ctx.roundRect(best[0] - w / 2, best[1] - h / 2, w, h, 6 * pr);
    ctx.fillStyle = r.color;
    ctx.fill();
    ctx.lineWidth = 1.5 * pr;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = r.color === '#E6C700' ? '#1b1f24' : '#fff';
    ctx.fillText(text, best[0], best[1] + 0.5 * pr);
  });
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
