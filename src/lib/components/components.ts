/**
 * Data component videos (EPIC-5, STORY-32..34): elevation profile, pace, heart rate, elapsed time and elapsed
 * distance. Each component is drawn by a pure function of (config, track data, time t), so every component
 * video of an export lines up frame by frame with the map video. Opaque, styleable background (no alpha:
 * product decision). Drawn directly at the output pixel size.
 */
import { formatDistance, formatDuration } from '../format';
import { decimalSep, translate, type MsgKey, type Params, type VideoLocale } from '../i18n/core';
import { formatDiff, type SplitRow } from '../results/splits';
import type { Track } from '../track/track';

export type ComponentKind = 'elevation' | 'pace' | 'heartRate' | 'time' | 'distance' | 'splits';

export interface ComponentStyle {
  background: string;
  text: string;
  muted: string;
  accent: string;
  showLabel: boolean;
  showIcon: boolean;
}

export interface ComponentOptions {
  /** Elevation: x axis. */
  xAxis: 'distance' | 'time';
  /** Elevation: control ticks; Time/Distance: also show the current leg value. */
  showControls: boolean;
  /** Pace smoothing window (s). */
  paceWindow: number;
  /** Heart rate zone thresholds (bpm, ascending, 4 values → 5 zones). */
  hrZones: number[];
  /** Before the start passing: show a countdown (negative time) or zero. */
  beforeStart: 'countdown' | 'zero';
  /** Splits: how long a control's splits stay fully visible (video s); the finish has its own time. */
  splitShow: number;
  splitShowFinish: number;
  /** Splits: fade-in / fade-out (video s). */
  splitFadeIn: number;
  splitFadeOut: number;
  /** Splits: solid colour of the frame while nothing is shown (chroma-key it in the editor). */
  keyColor: string;
  /** Splits: show leg / total ranks. */
  showRank: boolean;
}

export interface ComponentConfig {
  kind: ComponentKind;
  enabled: boolean;
  width: number;
  height: number;
  style: ComponentStyle;
  options: ComponentOptions;
}

export const COMPONENT_META: Record<
  ComponentKind,
  { label: string; size: [number, number]; needs?: 'elevation' | 'heartRate' | 'results' }
> = {
  elevation: { label: 'Elevation profile', size: [1200, 300], needs: 'elevation' },
  pace: { label: 'Pace', size: [520, 180] },
  heartRate: { label: 'Heart rate', size: [520, 180], needs: 'heartRate' },
  time: { label: 'Elapsed time', size: [520, 180] },
  distance: { label: 'Distance', size: [520, 180] },
  splits: { label: 'Splits', size: [760, 200], needs: 'results' },
};

export const DEFAULT_COMPONENT_STYLE: ComponentStyle = {
  background: '#14181f',
  text: '#ffffff',
  muted: '#9aa6b5',
  accent: '#ff6a2b',
  showLabel: true,
  showIcon: true,
};

export const DEFAULT_COMPONENT_OPTIONS: ComponentOptions = {
  xAxis: 'distance',
  showControls: true,
  paceWindow: 10,
  hrZones: [120, 140, 155, 170],
  beforeStart: 'countdown',
  splitShow: 5,
  splitShowFinish: 8,
  splitFadeIn: 0.3,
  splitFadeOut: 0.5,
  keyColor: '#00b140',
  showRank: true,
};

export function defaultComponents(): ComponentConfig[] {
  return (Object.keys(COMPONENT_META) as ComponentKind[]).map((kind) => ({
    kind,
    enabled: false,
    width: COMPONENT_META[kind].size[0],
    height: COMPONENT_META[kind].size[1],
    style: { ...DEFAULT_COMPONENT_STYLE },
    options: { ...DEFAULT_COMPONENT_OPTIONS, hrZones: [...DEFAULT_COMPONENT_OPTIONS.hrZones] },
  }));
}

/** Data a component needs for one frame. */
export interface ComponentData {
  track: Track;
  /** Track time of the frame. */
  t: number;
  /** Export range (track s): the elevation profile spans it. */
  rangeStart: number;
  rangeEnd: number;
  /** Origin of elapsed time/distance (start passing in course mode, else the range start). */
  origin: number;
  /** Passing times of course points (for control ticks and leg values), if any. */
  passings: number[] | null;
  /** Language of the texts in the video (labels, decimal separator). Default English. */
  locale?: VideoLocale;
  /** Playback speed (track s per video s): display times of the splits component are in video seconds. */
  speed?: number;
  /** Split comparison events (control passings with their rows), sorted by time; null = no results. */
  splits?: SplitEvent[] | null;
}

/** A control passing shown by the splits component. */
export interface SplitEvent {
  /** Track time of the passing. */
  t: number;
  /** Control number on the course (1-based); the finish row has `row.finish`. */
  number: number;
  row: SplitRow;
}

const L = (d: ComponentData, key: MsgKey, params?: Params) => translate(d.locale ?? 'en', key, params);

/** `hasResults`: split comparison data exists (results imported, runner chosen, course synced). */
export function isAvailable(kind: ComponentKind, track: Track | null, hasResults = false): boolean {
  const need = COMPONENT_META[kind].needs;
  if (!track) return false;
  if (need === 'results') return hasResults;
  if (need === 'elevation') return track.channels.elevation;
  if (need === 'heartRate') return track.channels.heartRate;
  return true;
}

// ---------------------------------------------------------------- values

export function elapsedTimeText(d: ComponentData, o: ComponentOptions): string {
  const dt = d.t - d.origin;
  return formatDuration(dt < 0 && o.beforeStart === 'zero' ? 0 : dt);
}

export function elapsedDistanceText(d: ComponentData): string {
  const m = d.track.positionAt(d.t).d - d.track.positionAt(Math.max(d.origin, 0)).d;
  return formatDistance(Math.max(0, m), decimalSep(d.locale ?? 'en'));
}

/** Current leg: [start passing, next passing] containing t, else null. */
export function currentLeg(d: ComponentData): [number, number] | null {
  const p = d.passings;
  if (!p || p.length < 2) return null;
  for (let i = 0; i + 1 < p.length; i++) if (d.t >= p[i] && d.t < p[i + 1]) return [p[i], p[i + 1]];
  return null;
}

export function hrZone(hr: number, zones: number[]): number {
  let z = 0;
  while (z < zones.length && hr >= zones[z]) z++;
  return z; // 0..zones.length
}

const ZONE_COLORS = ['#7f8c9d', '#3ccf8e', '#f5d142', '#ff9f2e', '#ff4d4d'];

/**
 * The split event visible at track time `d.t` and its opacity (0..1): fade in at the passing, fully visible
 * for the display time, then fade out (all in video seconds). A later passing replaces an earlier one.
 */
export function splitsVisibility(d: ComponentData, o: ComponentOptions): { event: SplitEvent; alpha: number } | null {
  const ev = d.splits;
  if (!ev?.length) return null;
  let i = -1;
  for (let k = 0; k < ev.length; k++) if (ev[k].t <= d.t) i = k;
  if (i < 0) return null;
  const e = ev[i];
  const age = (d.t - e.t) / Math.max(1e-6, d.speed ?? 1);
  const fin = Math.max(0, o.splitFadeIn);
  const show = Math.max(0, e.row.finish ? o.splitShowFinish : o.splitShow);
  const fout = Math.max(0, o.splitFadeOut);
  let alpha: number;
  if (age < fin) alpha = age / fin;
  else if (age < fin + show) alpha = 1;
  else if (age < fin + show + fout) alpha = 1 - (age - fin - show) / fout;
  else alpha = 0;
  return alpha > 0 ? { event: e, alpha } : null;
}

// ---------------------------------------------------------------- elevation profile data

interface Profile {
  /** Sample positions (distance m or time s from range start) and smoothed elevations. */
  x: Float64Array;
  ele: Float64Array;
  min: number;
  max: number;
  ascent: number;
}

const profileCache = new WeakMap<Track, Map<string, Profile>>();

export function elevationProfile(track: Track, start: number, end: number, axis: 'distance' | 'time'): Profile {
  let m = profileCache.get(track);
  if (!m) profileCache.set(track, (m = new Map()));
  const key = `${start}|${end}|${axis}`;
  const hit = m.get(key);
  if (hit) return hit;
  const N = 400;
  const t0 = Math.max(0, start);
  const t1 = Math.max(t0 + 1e-6, Math.min(track.duration, end));
  const raw = new Float64Array(N);
  const x = new Float64Array(N);
  const d0 = track.positionAt(t0).d;
  const d1 = track.positionAt(t1).d;
  for (let k = 0; k < N; k++) {
    const t =
      axis === 'time' ? t0 + ((t1 - t0) * k) / (N - 1) : track.positionAtDistance(d0 + ((d1 - d0) * k) / (N - 1)).t;
    raw[k] = track.elevationAt(t) ?? 0;
    x[k] = axis === 'time' ? t - t0 : track.positionAt(t).d - d0;
  }
  // Moving average to tame GPS/barometric noise.
  const ele = new Float64Array(N);
  const w = 4;
  for (let k = 0; k < N; k++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, k - w); j <= Math.min(N - 1, k + w); j++) {
      s += raw[j];
      c++;
    }
    ele[k] = s / c;
  }
  let min = Infinity;
  let max = -Infinity;
  let ascent = 0;
  for (let k = 0; k < N; k++) {
    min = Math.min(min, ele[k]);
    max = Math.max(max, ele[k]);
    if (k > 0 && ele[k] > ele[k - 1]) ascent += ele[k] - ele[k - 1];
  }
  const p = { x, ele, min, max, ascent };
  m.set(key, p);
  return p;
}

// ---------------------------------------------------------------- drawing

function card(ctx: CanvasRenderingContext2D, w: number, h: number, s: ComponentStyle) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws text with digits in fixed-width slots (canvas has no tabular-nums), so values do not jitter
 * sideways as they change. Returns the drawn width. Left-aligned at x.
 */
export function fillTabular(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  const digit = ctx.measureText('0').width;
  let cx = x;
  const align = ctx.textAlign;
  ctx.textAlign = 'center';
  for (const ch of text) {
    const w = /[0-9]/.test(ch) ? digit : ctx.measureText(ch).width;
    ctx.fillText(ch, cx + w / 2, y);
    cx += w;
  }
  ctx.textAlign = align;
  return cx - x;
}

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** A label + big value layout shared by the numeric components. */
function numeric(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ComponentStyle,
  label: string,
  value: string,
  unit: string,
  icon: ((x: number, y: number, size: number) => void) | null,
  valueColor = s.text,
  sub?: string,
) {
  card(ctx, w, h, s);
  const pad = h * 0.14;
  let x = pad;
  if (s.showIcon && icon) {
    const size = h * 0.42;
    icon(x + size / 2, h / 2, size);
    x += size + pad * 0.8;
  }
  const hasLabel = s.showLabel && label;
  const valueSize = h * (hasLabel ? 0.42 : 0.52);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (hasLabel) {
    ctx.font = `600 ${h * 0.15}px ${FONT}`;
    ctx.fillStyle = s.muted;
    ctx.fillText(label.toUpperCase(), x, pad + h * 0.14);
  }
  ctx.font = `700 ${valueSize}px ${FONT}`;
  ctx.fillStyle = valueColor;
  const vy = hasLabel ? h - pad - (sub ? h * 0.12 : 0) : h / 2 + valueSize * 0.36;
  const vw = fillTabular(ctx, value, x, vy);
  if (unit) {
    ctx.font = `600 ${valueSize * 0.42}px ${FONT}`;
    ctx.fillStyle = s.muted;
    ctx.fillText(unit, x + vw + h * 0.05, vy);
  }
  if (sub) {
    ctx.font = `600 ${h * 0.12}px ${FONT}`;
    ctx.fillStyle = s.muted;
    ctx.textAlign = 'right';
    ctx.fillText(sub, w - pad, vy);
  }
}

function iconClock(ctx: CanvasRenderingContext2D, color: string) {
  return (x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - size * 0.25);
    ctx.moveTo(x, y);
    ctx.lineTo(x + size * 0.18, y + size * 0.1);
    ctx.stroke();
    ctx.restore();
  };
}

function iconHeart(ctx: CanvasRenderingContext2D, color: string, scale: number) {
  return (x: number, y: number, size: number) => {
    const s = (size / 2) * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.45);
    ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.85);
    ctx.fill();
    ctx.restore();
  };
}

function iconRunner(ctx: CanvasRenderingContext2D, color: string) {
  // Simple speedometer.
  return (x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + size * 0.12, size * 0.42, Math.PI * 1.05, Math.PI * 1.95);
    ctx.moveTo(x, y + size * 0.12);
    ctx.lineTo(x + size * 0.22, y - size * 0.12);
    ctx.stroke();
    ctx.restore();
  };
}

function iconRoute(ctx: CanvasRenderingContext2D, color: string) {
  return (x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.4, y + size * 0.35);
    ctx.bezierCurveTo(x - size * 0.1, y - size * 0.1, x + size * 0.1, y + size * 0.3, x + size * 0.4, y - size * 0.35);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y - size * 0.35, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
}

/** Draws one component frame into ctx (canvas size = cfg.width × cfg.height). */
export function drawComponent(ctx: CanvasRenderingContext2D, cfg: ComponentConfig, d: ComponentData): void {
  const { width: w, height: h, style: s, options: o } = cfg;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  switch (cfg.kind) {
    case 'time': {
      const leg = o.showControls ? currentLeg(d) : null;
      numeric(
        ctx,
        w,
        h,
        s,
        L(d, 'vid.time'),
        elapsedTimeText(d, o),
        '',
        iconClock(ctx, s.accent),
        s.text,
        leg ? L(d, 'vid.leg', { value: formatDuration(d.t - leg[0]) }) : undefined,
      );
      break;
    }
    case 'distance': {
      const leg = o.showControls ? currentLeg(d) : null;
      const legM = leg ? d.track.positionAt(d.t).d - d.track.positionAt(leg[0]).d : 0;
      const [num, unit] = splitUnit(elapsedDistanceText(d));
      numeric(
        ctx,
        w,
        h,
        s,
        L(d, 'vid.distance'),
        num,
        unit,
        iconRoute(ctx, s.accent),
        s.text,
        leg ? L(d, 'vid.leg', { value: formatDistance(legM, decimalSep(d.locale ?? 'en')) }) : undefined,
      );
      break;
    }
    case 'pace': {
      const p = d.track.paceAt(d.t, o.paceWindow);
      const v = p === null || p > 3600 ? '–:––' : formatDuration(p);
      numeric(ctx, w, h, s, L(d, 'vid.pace'), v, '/km', iconRunner(ctx, s.accent));
      break;
    }
    case 'heartRate': {
      const hr = d.track.heartRateAt(d.t);
      const zone = hr === null ? 0 : hrZone(hr, o.hrZones);
      // Deterministic "beat": phase from track time and heart rate.
      const beat = hr ? 1 + 0.12 * Math.max(0, Math.cos(2 * Math.PI * ((d.t * hr) / 60))) ** 8 : 1;
      numeric(
        ctx,
        w,
        h,
        s,
        L(d, 'vid.hr'),
        hr === null ? '–' : String(Math.round(hr)),
        'bpm',
        iconHeart(ctx, ZONE_COLORS[zone], beat),
        s.text,
        hr === null ? undefined : L(d, 'vid.zone', { n: zone + 1 }),
      );
      break;
    }
    case 'elevation':
      drawElevation(ctx, cfg, d);
      break;
    case 'splits':
      drawSplits(ctx, cfg, d);
      break;
  }
  ctx.restore();
}

const LEAD_COLOR = '#3ccf8e';

/** Splits: key colour while hidden; the card fades in over it at each control passing. */
function drawSplits(ctx: CanvasRenderingContext2D, cfg: ComponentConfig, d: ComponentData) {
  const { width: w, height: h, style: s, options: o } = cfg;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = o.keyColor;
  ctx.fillRect(0, 0, w, h);
  const vis = splitsVisibility(d, o);
  if (!vis) return;
  const { row, number } = vis.event;
  ctx.globalAlpha = vis.alpha;
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, w, h);

  const pad = h * 0.12;
  const labelY = pad + h * 0.12;
  const valueY = h * 0.62;
  const diffY = h - pad;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const label = (text: string, x: number) => {
    if (!s.showLabel) return;
    ctx.font = `600 ${h * 0.12}px ${FONT}`;
    ctx.fillStyle = s.muted;
    ctx.fillText(text.toUpperCase(), x, labelY);
  };

  // Control number (or finish).
  const colW = (w - pad * 2) / 3.2;
  label(row.finish ? L(d, 'vid.finish') : L(d, 'vid.control'), pad);
  ctx.font = `800 ${h * 0.46}px ${FONT}`;
  ctx.fillStyle = s.accent;
  fillTabular(ctx, row.finish ? '◎' : String(number), pad, h * 0.78);

  const column = (x: number, title: string, time: number | null, diff: number | null, rank: number | null) => {
    label(title, x);
    ctx.font = `700 ${h * 0.3}px ${FONT}`;
    ctx.fillStyle = s.text;
    fillTabular(ctx, time === null ? '–' : formatDuration(time), x, valueY);
    ctx.font = `700 ${h * 0.2}px ${FONT}`;
    ctx.fillStyle = diff === null ? s.muted : diff < 0.5 ? LEAD_COLOR : s.accent;
    const dw = fillTabular(ctx, formatDiff(diff), x, diffY);
    if (o.showRank && rank !== null) {
      ctx.font = `600 ${h * 0.15}px ${FONT}`;
      ctx.fillStyle = s.muted;
      ctx.fillText(`${rank}.`, x + dw + h * 0.08, diffY);
    }
  };
  column(pad + colW * 1.0, L(d, 'vid.splitLeg'), row.leg, row.legDiff, row.legRank);
  column(pad + colW * 2.1, L(d, 'vid.splitTotal'), row.elapsed, row.totalDiff, row.totalRank);
  ctx.globalAlpha = 1;
}

function splitUnit(text: string): [string, string] {
  const i = text.lastIndexOf(' ');
  return i > 0 ? [text.slice(0, i), text.slice(i + 1)] : [text, ''];
}

function drawElevation(ctx: CanvasRenderingContext2D, cfg: ComponentConfig, d: ComponentData) {
  const { width: w, height: h, style: s, options: o } = cfg;
  card(ctx, w, h, s);
  const p = elevationProfile(d.track, d.rangeStart, d.rangeEnd, o.xAxis);
  const padX = h * 0.08;
  const top = h * (s.showLabel ? 0.28 : 0.1);
  const bottom = h - h * 0.1;
  const left = padX;
  const right = w - padX;
  const span = Math.max(5, p.max - p.min);
  const lo = p.min - span * 0.1;
  const hi = p.max + span * 0.1;
  const xMax = p.x[p.x.length - 1] || 1;
  const X = (v: number) => left + ((right - left) * v) / xMax;
  const Y = (e: number) => bottom - ((bottom - top) * (e - lo)) / (hi - lo);

  const t0 = Math.max(0, d.rangeStart);
  const nowX =
    o.xAxis === 'time'
      ? Math.min(xMax, Math.max(0, d.t - t0))
      : Math.min(xMax, Math.max(0, d.track.positionAt(d.t).d - d.track.positionAt(t0).d));

  const path = (upTo: number) => {
    ctx.beginPath();
    ctx.moveTo(X(p.x[0]), bottom);
    for (let k = 0; k < p.x.length && p.x[k] <= upTo; k++) ctx.lineTo(X(p.x[k]), Y(p.ele[k]));
    const last = Math.min(upTo, xMax);
    ctx.lineTo(X(last), Y(interp(p, last)));
    ctx.lineTo(X(last), bottom);
    ctx.closePath();
  };
  // Whole profile (muted) and completed part (accent).
  path(xMax);
  ctx.fillStyle = withAlpha(s.muted, 0.28);
  ctx.fill();
  path(nowX);
  ctx.fillStyle = withAlpha(s.accent, 0.55);
  ctx.fill();
  ctx.beginPath();
  for (let k = 0; k < p.x.length; k++) {
    if (k === 0) ctx.moveTo(X(p.x[k]), Y(p.ele[k]));
    else ctx.lineTo(X(p.x[k]), Y(p.ele[k]));
  }
  ctx.strokeStyle = s.muted;
  ctx.lineWidth = Math.max(1.5, h * 0.008);
  ctx.stroke();

  // Control ticks.
  if (o.showControls && d.passings) {
    ctx.strokeStyle = withAlpha('#bb29bb', 0.9);
    ctx.lineWidth = Math.max(1.5, h * 0.007);
    ctx.fillStyle = s.muted;
    ctx.font = `700 ${h * 0.075}px ${FONT}`;
    ctx.textAlign = 'center';
    d.passings.forEach((tp, i) => {
      if (i === 0 || i === d.passings!.length - 1 || tp < t0 || tp > d.rangeEnd) return;
      const xv = o.xAxis === 'time' ? tp - t0 : d.track.positionAt(tp).d - d.track.positionAt(t0).d;
      const x = X(xv);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillText(String(i), x, top - h * 0.02);
    });
  }

  // Current position marker.
  const mx = X(nowX);
  const my = Y(interp(p, nowX));
  ctx.beginPath();
  ctx.arc(mx, my, h * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = s.accent;
  ctx.fill();
  ctx.lineWidth = h * 0.012;
  ctx.strokeStyle = s.text;
  ctx.stroke();

  if (s.showLabel) {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `600 ${h * 0.1}px ${FONT}`;
    ctx.fillStyle = s.muted;
    ctx.fillText(L(d, 'vid.elevation').toUpperCase(), padX, h * 0.17);
    ctx.textAlign = 'right';
    ctx.font = `700 ${h * 0.12}px ${FONT}`;
    ctx.fillStyle = s.text;
    const cur = d.track.elevationAt(d.t);
    ctx.fillText(`${cur === null ? '–' : Math.round(cur)} m  ↑${Math.round(p.ascent)} m`, right, h * 0.18);
  }
}

function interp(p: Profile, x: number): number {
  const n = p.x.length;
  if (x <= p.x[0]) return p.ele[0];
  if (x >= p.x[n - 1]) return p.ele[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.x[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - p.x[lo]) / Math.max(1e-9, p.x[hi] - p.x[lo]);
  return p.ele[lo] + (p.ele[hi] - p.ele[lo]) * f;
}

/** `#rrggbb` + alpha → rgba(). */
export function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
