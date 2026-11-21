/**
 * Track model (EN-4): time/distance lookups, normalized heading smoothed in TRACK time
 * (deterministic: same t → same value in preview and export), pace, heart rate, elevation.
 */
import { angleDiff, bearing, normalizeAngle, segmentDistance, type LatLon } from '../geo/geo';
import type { GpxPoint } from '../gpx/gpx';

export interface TrackPoint extends LatLon {
  /** Seconds since track start. */
  t: number;
  /** Cumulative distance (m). */
  d: number;
}

export interface TrackChannels {
  time: boolean;
  elevation: boolean;
  heartRate: boolean;
  cadence: boolean;
}

/** Speed assumed when the GPX has no usable timestamps (m/s). */
export const FALLBACK_SPEED = 3;
/** Below this speed (m/s) pace is undefined ("standing still"). */
export const MIN_PACE_SPEED = 0.5;
const HEADING_STEP = 0.25;

export interface TrackOptions {
  /** Heading chord length (m). */
  headingWindow?: number;
  /** Heading smoothing time constant, in track seconds. */
  headingTau?: number;
}

export class Track {
  readonly name: string;
  readonly points: TrackPoint[];
  readonly ele: (number | null)[];
  readonly hr: (number | null)[];
  readonly duration: number;
  readonly length: number;
  /** Epoch ms of t = 0, or null without timestamps. */
  readonly startTime: number | null;
  readonly channels: TrackChannels;
  readonly headingWindow: number;
  readonly headingTau: number;
  private headingSeries: Float64Array | null = null;

  constructor(name: string, src: GpxPoint[], opts: TrackOptions = {}) {
    if (src.length < 2) throw new Error('Track needs at least two points');
    this.name = name;
    this.headingWindow = opts.headingWindow ?? 30;
    this.headingTau = opts.headingTau ?? 1.5;
    const hasTime = src.every((p) => p.time !== null);
    const t0 = hasTime ? src[0].time! : 0;
    const pts: TrackPoint[] = [];
    let d = 0;
    let t = 0;
    for (let i = 0; i < src.length; i++) {
      const p = src[i];
      if (i > 0) {
        const seg = segmentDistance(src[i - 1], p);
        d += seg;
        // Clamp so time never goes backwards in sloppy files.
        t = hasTime ? Math.max(t, (p.time! - t0) / 1000) : t + seg / FALLBACK_SPEED;
      }
      pts.push({ lat: p.lat, lon: p.lon, t, d });
    }
    this.points = pts;
    this.ele = src.map((p) => p.ele);
    this.hr = src.map((p) => p.hr);
    this.duration = t;
    this.length = d;
    this.startTime = hasTime ? t0 : null;
    this.channels = {
      time: hasTime,
      elevation: src.some((p) => p.ele !== null),
      heartRate: src.some((p) => p.hr !== null),
      cadence: src.some((p) => p.cad !== null),
    };
  }

  /** Index i with points[i].key <= v < points[i+1].key (clamped to [0, n-2]). */
  private segmentIndex(key: 't' | 'd', v: number): number {
    const pts = this.points;
    let lo = 0;
    let hi = pts.length - 1;
    if (v <= pts[0][key]) return 0;
    if (v >= pts[hi][key]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid][key] <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  private fraction(key: 't' | 'd', i: number, v: number): number {
    const a = this.points[i][key];
    const span = this.points[i + 1][key] - a;
    return span > 0 ? Math.min(1, Math.max(0, (v - a) / span)) : 0;
  }

  private interpolate(key: 't' | 'd', v: number): TrackPoint {
    const i = this.segmentIndex(key, v);
    const f = this.fraction(key, i, v);
    const a = this.points[i];
    const b = this.points[i + 1];
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      t: a.t + (b.t - a.t) * f,
      d: a.d + (b.d - a.d) * f,
    };
  }

  positionAt(t: number): TrackPoint {
    return this.interpolate('t', t);
  }

  positionAtDistance(d: number): TrackPoint {
    return this.interpolate('d', d);
  }

  /** Index of the last original point at or before time t. */
  indexAt(t: number): number {
    if (t >= this.duration) return this.points.length - 1;
    return this.segmentIndex('t', t);
  }

  /** Raw normalized heading: bearing of the `window`-metre chord centred on the position; null if < 1 m. */
  rawHeadingAt(t: number, window = this.headingWindow): number | null {
    const here = this.positionAt(t);
    const a = this.positionAtDistance(here.d - window / 2);
    const b = this.positionAtDistance(here.d + window / 2);
    if (segmentDistance(a, b) < 1) return null;
    return bearing(a, b);
  }

  /**
   * Smoothed normalized heading at t (degrees, true bearing). Zero-phase exponential smoothing
   * (forward + backward pass) over a precomputed series in track time. Standing still keeps the
   * previous heading.
   */
  headingAt(t: number): number {
    const s = this.getHeadingSeries();
    const x = Math.min(Math.max(t, 0), this.duration) / HEADING_STEP;
    const i = Math.min(Math.floor(x), s.length - 2);
    const f = Math.min(1, x - i);
    return normalizeAngle(s[i] + (s[i + 1] - s[i]) * f);
  }

  private getHeadingSeries(): Float64Array {
    if (this.headingSeries) return this.headingSeries;
    const n = Math.max(2, Math.ceil(this.duration / HEADING_STEP) + 1);
    const raw = new Float64Array(n);
    let first: number | null = null;
    for (let i = 0; i < n && first === null; i++) first = this.rawHeadingAt(i * HEADING_STEP);
    let prev = first ?? 0;
    // Unwrapped (continuous) angles so smoothing never crosses the 0/360 seam the long way.
    for (let i = 0; i < n; i++) {
      const h = this.rawHeadingAt(i * HEADING_STEP);
      prev = h === null ? prev : prev + angleDiff(prev, h);
      raw[i] = prev;
    }
    const a = 1 - Math.exp(-HEADING_STEP / this.headingTau);
    for (let i = 1; i < n; i++) raw[i] = raw[i - 1] + (raw[i] - raw[i - 1]) * a;
    for (let i = n - 2; i >= 0; i--) raw[i] = raw[i + 1] + (raw[i] - raw[i + 1]) * a;
    this.headingSeries = raw;
    return raw;
  }

  /** Speed (m/s) averaged over ±windowSec. */
  speedAt(t: number, windowSec = 5): number {
    const t0 = Math.max(0, t - windowSec);
    const t1 = Math.min(this.duration, t + windowSec);
    if (t1 <= t0) return 0;
    return (this.positionAt(t1).d - this.positionAt(t0).d) / (t1 - t0);
  }

  /** Pace in seconds per km (averaged over the last `windowSec`), or null when standing still. */
  paceAt(t: number, windowSec = 10): number | null {
    const t0 = Math.max(0, t - windowSec);
    if (t <= t0) return null;
    const v = (this.positionAt(t).d - this.positionAt(t0).d) / (t - t0);
    return v < MIN_PACE_SPEED ? null : 1000 / v;
  }

  private channelAt(values: (number | null)[], t: number): number | null {
    const i = this.indexAt(t);
    const a = values[i];
    const b = values[Math.min(i + 1, values.length - 1)];
    if (a === null || b === null) return a ?? b;
    if (i >= this.points.length - 1) return a;
    return a + (b - a) * this.fraction('t', i, t);
  }

  heartRateAt(t: number): number | null {
    return this.channels.heartRate ? this.channelAt(this.hr, t) : null;
  }

  elevationAt(t: number): number | null {
    return this.channels.elevation ? this.channelAt(this.ele, t) : null;
  }

  center(): LatLon {
    const b = this.bounds();
    return { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 };
  }

  bounds(): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
    let minLat = Infinity,
      maxLat = -Infinity,
      minLon = Infinity,
      maxLon = -Infinity;
    for (const p of this.points) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    }
    return { minLat, maxLat, minLon, maxLon };
  }
}
