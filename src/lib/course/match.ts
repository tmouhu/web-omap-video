/**
 * GPX ↔ course matching (STORY-22/23).
 *
 * For every course point the candidates are local minima of the distance track→point within `radius`.
 * A dynamic programme then picks one candidate per point (or "not found") so that passing times strictly
 * increase in course order and the summed distance (+ a penalty per missing point) is minimal. This
 * handles butterfly loops, controls visited twice and crossing legs. Manual times are fixed constraints.
 */
import { segmentDistance, type LatLon } from '../geo/geo';
import type { Track } from '../track/track';
import type { Course } from './course';

export type PassingStatus = 'auto' | 'manual' | 'not-found' | 'start-of-track' | 'end-of-track';

export interface Passing {
  pointId: string;
  /** Track time (s since GPX start). */
  t: number;
  /** Distance between the track at `t` and the course point (m). */
  distance: number;
  status: PassingStatus;
  /** Number of candidate passes within the radius (ambiguity indicator). */
  candidates: number;
}

export interface MatchOptions {
  /** Search radius around each course point (m). */
  radius?: number;
  /** Manual passing times, track seconds by point id. */
  overrides?: Record<string, number>;
}

interface Candidate {
  t: number;
  d: number;
}

/** For each track segment, its closest point to `p` (time and distance in metres, local tangent plane). */
function segmentClosest(track: Track, p: LatLon): Candidate[] {
  const pts = track.points;
  const n = pts.length;
  const out: Candidate[] = new Array(n - 1);
  const kx = segmentDistance(p, { lat: p.lat, lon: p.lon + 0.001 }) / 0.001;
  const ky = segmentDistance(p, { lat: p.lat + 0.001, lon: p.lon }) / 0.001;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = (a.lon - p.lon) * kx;
    const ay = (a.lat - p.lat) * ky;
    const dx = (b.lon - p.lon) * kx - ax;
    const dy = (b.lat - p.lat) * ky - ay;
    const L2 = dx * dx + dy * dy;
    const f = L2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / L2)) : 0;
    out[i] = { t: a.t + (b.t - a.t) * f, d: Math.hypot(ax + dx * f, ay + dy * f) };
  }
  return out;
}

/** Candidate passes: each "visit" inside `radius` contributes its closest point. */
export function candidatesFor(track: Track, p: LatLon, radius: number): Candidate[] {
  const out: Candidate[] = [];
  let cur: Candidate | null = null;
  for (const s of segmentClosest(track, p)) {
    if (s.d <= radius) {
      if (!cur || s.d < cur.d) cur = { ...s };
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Closest approach of the track to `p` within the time window [t0, t1] (used for "not found" points). */
export function closestInWindow(track: Track, p: LatLon, t0: number, t1: number): Candidate {
  let best: Candidate = { t: t0, d: Infinity };
  for (const s of segmentClosest(track, p)) {
    if (s.t >= t0 && s.t <= t1 && s.d < best.d) best = s;
  }
  return best;
}

interface State {
  t: number;
  cost: number;
  choice: Candidate | null;
  prev: State | null;
}

/** Matches the track to the course. Returns one passing per course point, in course order. */
export function matchCourse(track: Track, course: Course, opts: MatchOptions = {}): Passing[] {
  const radius = opts.radius ?? 50;
  const overrides = opts.overrides ?? {};
  const penalty = radius * 3;
  const pts = course.points;
  const cands: Candidate[][] = pts.map((p) => {
    const o = overrides[p.id];
    if (o !== undefined) return [{ t: o, d: segmentDistance(track.positionAt(o), p) }];
    return candidatesFor(track, p, radius);
  });

  // DP over course points; each state remembers the last real passing time.
  let states: State[] = [{ t: -Infinity, cost: 0, choice: null, prev: null }];
  pts.forEach((p, k) => {
    const next: State[] = [];
    const fixed = overrides[p.id] !== undefined;
    for (const s of states) {
      if (!fixed) next.push({ t: s.t, cost: s.cost + penalty, choice: null, prev: s });
      for (const c of cands[k]) {
        if (c.t > s.t || (fixed && c.t >= s.t))
          next.push({ t: c.t, cost: s.cost + (fixed ? 0 : c.d), choice: c, prev: s });
      }
    }
    // Prune: for equal last-time keep the cheapest; drop states dominated by an earlier, cheaper one.
    next.sort((a, b) => a.t - b.t || a.cost - b.cost);
    const pruned: State[] = [];
    let bestCost = Infinity;
    for (const s of next) {
      if (s.cost < bestCost) {
        pruned.push(s);
        bestCost = s.cost;
      }
    }
    states = pruned.length ? pruned : next.slice(0, 1);
  });

  // Backtrack the cheapest final state.
  let s: State | null = states.reduce((a, b) => (b.cost < a.cost ? b : a));
  const chosen: (Candidate | null)[] = new Array(pts.length).fill(null);
  for (let k = pts.length - 1; k >= 0 && s; k--) {
    chosen[k] = s.choice;
    s = s.prev;
  }

  // Fill gaps: start → track start, finish → track end, controls → closest approach between neighbours.
  const result: Passing[] = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const c = chosen[k];
    const manual = overrides[p.id] !== undefined;
    if (c) {
      result.push({
        pointId: p.id,
        t: c.t,
        distance: c.d,
        status: manual ? 'manual' : 'auto',
        candidates: cands[k].length,
      });
      continue;
    }
    const prevT = result.length ? result[result.length - 1].t : 0;
    const nextT = chosen.slice(k + 1).find((x) => x)?.t ?? track.duration;
    if (p.kind === 'start' && k === 0) {
      result.push({
        pointId: p.id,
        t: 0,
        distance: segmentDistance(track.positionAt(0), p),
        status: 'start-of-track',
        candidates: 0,
      });
    } else if (p.kind === 'finish' && k === pts.length - 1) {
      const t = track.duration;
      result.push({
        pointId: p.id,
        t,
        distance: segmentDistance(track.positionAt(t), p),
        status: 'end-of-track',
        candidates: 0,
      });
    } else {
      const w = closestInWindow(track, p, prevT, nextT);
      result.push({ pointId: p.id, t: w.t, distance: w.d, status: 'not-found', candidates: 0 });
    }
  }
  // Guarantee monotonic times (estimates may tie with neighbours).
  for (let k = 1; k < result.length; k++) if (result[k].t < result[k - 1].t) result[k].t = result[k - 1].t;
  return result;
}

/** Checks that manual times keep the course order; returns an error message or null. */
export function validateOverride(course: Course, passings: Passing[], pointId: string, t: number): string | null {
  const k = course.points.findIndex((p) => p.id === pointId);
  if (k < 0) return 'Unknown control.';
  const prev = passings[k - 1];
  const next = passings[k + 1];
  if (prev && t <= prev.t && prev.status === 'manual') return 'The time must be after the previous control.';
  if (next && t >= next.t && next.status === 'manual') return 'The time must be before the next control.';
  return null;
}
