/**
 * Vector scene and overlays drawn on a 2D canvas on top of the OpenLayers layers (EN-2).
 * One function draws both the preview overlay and each export frame, so they look identical.
 * Sizes are given in CSS px and multiplied by `pixelRatio`.
 */
import { forward, gridConvergence, inverse } from '../geo/crs';
import { scaleForGroundResolution, toRad } from '../geo/geo';
import { pointScale } from '../geo/crs';
import { formatDistance, formatDuration, formatPace, formatScale } from '../format';
import type { ViewState } from '../anim/timeline';
import type { Track } from '../track/track';

export interface SceneStyle {
  showInfo: boolean;
  showNorthArrow: boolean;
  showScaleBar: boolean;
}

export const DEFAULT_SCENE_STYLE: SceneStyle = { showInfo: true, showNorthArrow: true, showScaleBar: true };

export interface SceneInput {
  crsCode: string;
  track: Track | null;
  /** Playback time (s), or null to hide the runner. */
  time: number | null;
  /** Grid heading (deg) for the arrow; null draws a dot. */
  heading: number | null;
  speed: number;
  attribution: string;
  style: SceneStyle;
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

function niceDistance(maxMeters: number): number {
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  for (const m of [5, 2, 1]) if (m * pow <= maxMeters) return m * pow;
  return pow;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pr: number,
  view: ViewState,
  scene: SceneInput,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const font = (px: number, weight = 500) =>
    `${weight} ${Math.round(px * pr)}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const pad = 12 * pr;
  const centre = inverse(scene.crsCode, view.center);

  if (scene.style.showNorthArrow) {
    // Points to true north: grid rotation + convergence at the view centre.
    const r = 17 * pr;
    ctx.save();
    ctx.translate(width - pad - r, pad + r);
    roundRect(ctx, -r, -r, 2 * r, 2 * r, r);
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
    ctx.font = font(9, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, 10 * pr);
    ctx.restore();
  }

  if (scene.style.showScaleBar) {
    const groundPerCss = view.resolution / pointScale(scene.crsCode, centre);
    const meters = niceDistance(groundPerCss * 110);
    const barPx = (meters / groundPerCss) * pr;
    const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
    const ratio = formatScale(scaleForGroundResolution(groundPerCss));
    ctx.font = font(11, 600);
    const ratioW = ctx.measureText(ratio).width;
    const bx = pad;
    const by = height - pad - 28 * pr;
    roundRect(ctx, bx, by, barPx + ratioW + 26 * pr, 28 * pr, 6 * pr);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill();
    ctx.fillStyle = '#1b1f24';
    const x0 = bx + 8 * pr;
    ctx.fillRect(x0, by + 19 * pr, barPx, 2.5 * pr);
    ctx.fillRect(x0, by + 14 * pr, 1.5 * pr, 7.5 * pr);
    ctx.fillRect(x0 + barPx - 1.5 * pr, by + 14 * pr, 1.5 * pr, 7.5 * pr);
    ctx.font = font(10, 600);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x0 + 2 * pr, by + 12 * pr);
    ctx.font = font(11, 600);
    ctx.fillText(ratio, x0 + barPx + 8 * pr, by + 21 * pr);
  }

  // Attribution: always visible (licence requirement).
  ctx.font = font(9.5, 500);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const aw = ctx.measureText(scene.attribution).width;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillRect(width - aw - 10 * pr, height - 16 * pr, aw + 10 * pr, 16 * pr);
  ctx.fillStyle = '#2a2f36';
  ctx.fillText(scene.attribution, width - 5 * pr, height - 4.5 * pr);

  if (scene.style.showInfo && scene.track && scene.time !== null) {
    const t = scene.time;
    const rows: [string, string][] = [
      ['Time', formatDuration(t)],
      ['Distance', formatDistance(scene.track.positionAt(t).d)],
      ['Pace', formatPace(scene.track.paceAt(t))],
    ];
    if (scene.speed !== 1) rows.push(['Speed', `${scene.speed}×`]);
    const lh = 19 * pr;
    ctx.font = font(12, 600);
    const labelW = Math.max(...rows.map(([l]) => ctx.measureText(l).width));
    ctx.font = font(14, 700);
    const valW = Math.max(...rows.map(([, v]) => ctx.measureText(v).width));
    const w = labelW + valW + 34 * pr;
    roundRect(ctx, pad, pad, w, lh * rows.length + 14 * pr, 8 * pr);
    ctx.fillStyle = 'rgba(14, 17, 22, 0.72)';
    ctx.fill();
    rows.forEach(([l, v], i) => {
      const y = pad + 7 * pr + lh * (i + 0.75);
      ctx.textAlign = 'left';
      ctx.font = font(12, 600);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(l, pad + 12 * pr, y);
      ctx.textAlign = 'right';
      ctx.font = font(14, 700);
      ctx.fillStyle = '#fff';
      ctx.fillText(v, pad + w - 12 * pr, y);
    });
  }
  ctx.restore();
}
