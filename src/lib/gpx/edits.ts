/**
 * Non-destructive GPX edits (STORY-21). The original points are never modified; the edited track is
 * `applyEdits(original, edits)`. Indices refer to the point list as it is when the edit is applied
 * (edits are replayed in order). Point TIMES are never changed by geometry edits, so playback timing
 * and alignment with the head cam stay the same.
 */
import { segmentDistance, type LatLon } from '../geo/geo';
import type { GpxPoint } from './gpx';

export type GpxEdit =
  /** Move point `index` to (lat, lon); neighbours within `radius` m along the track follow with smooth falloff. */
  | { type: 'move'; index: number; lat: number; lon: number; radius: number }
  /** Delete points from..to (inclusive). */
  | { type: 'delete'; from: number; to: number }
  /** Keep only points from..to (inclusive). */
  | { type: 'trim'; from: number; to: number }
  /** Shift points from..to by a constant offset (systematic GPS error). */
  | { type: 'shift'; from: number; to: number; dLat: number; dLon: number }
  /** Replace points from..to by a drawn path; times are spread along it by distance, keeping both end times. */
  | { type: 'redraw'; from: number; to: number; path: LatLon[] };

const lerp = (a: number | null, b: number | null, f: number) => (a === null || b === null ? (a ?? b) : a + (b - a) * f);

/** Cumulative along-track distance. */
function cumulative(pts: GpxPoint[]): number[] {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + segmentDistance(pts[i - 1], pts[i]));
  return d;
}

export function applyEdit(pts: GpxPoint[], e: GpxEdit): GpxPoint[] {
  const n = pts.length;
  const clamp = (i: number) => Math.min(n - 1, Math.max(0, i));
  switch (e.type) {
    case 'move': {
      const i = clamp(e.index);
      const dLat = e.lat - pts[i].lat;
      const dLon = e.lon - pts[i].lon;
      if (e.radius <= 0) return pts.map((p, k) => (k === i ? { ...p, lat: e.lat, lon: e.lon } : p));
      const d = cumulative(pts);
      return pts.map((p, k) => {
        const x = Math.abs(d[k] - d[i]) / e.radius;
        if (x >= 1) return p;
        const w = (1 - x * x) ** 2;
        return { ...p, lat: p.lat + dLat * w, lon: p.lon + dLon * w };
      });
    }
    case 'delete': {
      const a = clamp(Math.min(e.from, e.to));
      const b = clamp(Math.max(e.from, e.to));
      const out = [...pts.slice(0, a), ...pts.slice(b + 1)];
      return out.length >= 2 ? out : pts;
    }
    case 'trim': {
      const a = clamp(Math.min(e.from, e.to));
      const b = clamp(Math.max(e.from, e.to));
      return b - a >= 1 ? pts.slice(a, b + 1) : pts;
    }
    case 'shift': {
      const a = clamp(Math.min(e.from, e.to));
      const b = clamp(Math.max(e.from, e.to));
      return pts.map((p, k) => (k >= a && k <= b ? { ...p, lat: p.lat + e.dLat, lon: p.lon + e.dLon } : p));
    }
    case 'redraw': {
      const a = clamp(Math.min(e.from, e.to));
      const b = clamp(Math.max(e.from, e.to));
      if (e.path.length < 2 || b <= a) return pts;
      const pa = pts[a];
      const pb = pts[b];
      // Path from the range start through the drawn points to the range end.
      const path: LatLon[] = [pa, ...e.path, pb];
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + segmentDistance(path[k - 1], path[k]));
      const total = cum[cum.length - 1] || 1;
      const replaced = path.map((q, k): GpxPoint => {
        const f = cum[k] / total;
        return {
          lat: q.lat,
          lon: q.lon,
          time: pa.time === null || pb.time === null ? null : pa.time + (pb.time - pa.time) * f,
          ele: lerp(pa.ele, pb.ele, f),
          hr: lerp(pa.hr, pb.hr, f),
          cad: lerp(pa.cad, pb.cad, f),
        };
      });
      return [...pts.slice(0, a), ...replaced, ...pts.slice(b + 1)];
    }
  }
}

export function applyEdits(original: GpxPoint[], edits: GpxEdit[]): GpxPoint[] {
  return edits.reduce(applyEdit, original);
}

/**
 * GPS spikes: points that are reached and left at an impossible speed while their neighbours are
 * consistent with each other. Returns indices (ascending).
 */
export function findOutliers(pts: GpxPoint[], maxSpeed = 9): number[] {
  const out: number[] = [];
  const speed = (a: GpxPoint, b: GpxPoint) => {
    if (a.time === null || b.time === null) return 0;
    const dt = Math.max(0.5, (b.time - a.time) / 1000);
    return segmentDistance(a, b) / dt;
  };
  let prev = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[prev];
    const b = pts[i];
    const c = pts[i + 1];
    if (speed(a, b) > maxSpeed && speed(b, c) > maxSpeed && speed(a, c) <= maxSpeed) {
      out.push(i);
      continue; // keep `prev` at the last good point
    }
    prev = i;
  }
  return out;
}

/** Delete edits (one per contiguous run) that remove the given indices, highest first so indices stay valid. */
export function deleteEditsFor(indices: number[]): GpxEdit[] {
  const runs: [number, number][] = [];
  for (const i of [...indices].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else runs.push([i, i]);
  }
  return runs.reverse().map(([from, to]) => ({ type: 'delete', from, to }));
}
