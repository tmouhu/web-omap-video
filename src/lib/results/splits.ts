/**
 * Split comparison and course synchronisation from result lists (STORY-41).
 *
 * Comparison ("difference to lead"): for every control of the chosen runner, the leg and total time
 * minus the best leg / best elapsed time in the class at that control.
 * Sync: result controls are mapped to course points by control code (or position), and the runner's
 * punch times become GPX-clock passing times (start + split + clock offset).
 */
import { segmentDistance } from '../geo/geo';
import type { Course } from '../course/course';
import type { Track } from '../track/track';
import { isOk, type Competitor, type ReferenceMode, type ResultClass } from './results';

export type { ReferenceMode };

/** One row per class control, plus the finish as the last row. */
export interface SplitRow {
  /** Control code (`''` for the finish). */
  code: string;
  finish: boolean;
  /** Runner's elapsed time at the control (s), null = missing. */
  elapsed: number | null;
  /** Runner's leg time (s), null when this or the previous punch is missing. */
  leg: number | null;
  /** Runner's leg time minus the fastest leg time (s ≥ 0). */
  legDiff: number | null;
  /** Runner's elapsed time minus the best elapsed time at this control (s ≥ 0). */
  totalDiff: number | null;
  legRank: number | null;
  totalRank: number | null;
}

/** Elapsed times at controls + finish (null = missing). */
const elapsedRow = (c: Competitor) => [...c.splits, c.finish];

function legTimes(e: (number | null)[]): (number | null)[] {
  return e.map((v, i) => {
    const prev = i === 0 ? 0 : e[i - 1];
    return v === null || prev === null ? null : v - prev;
  });
}

const rank = (v: number, all: number[]) => 1 + all.filter((x) => x < v - 1e-6).length;

/** Splits of `runner` compared with the class (reference: OK competitors, or everyone with a time). */
export function compareSplits(cls: ResultClass, runner: number, mode: ReferenceMode = 'ok'): SplitRow[] {
  const me = cls.competitors[runner];
  if (!me) return [];
  const refs = cls.competitors.filter((c, i) => i === runner || mode === 'all' || isOk(c));
  const myE = elapsedRow(me);
  const myL = legTimes(myE);
  const refE = refs.map(elapsedRow);
  const refL = refE.map(legTimes);
  return myE.map((e, i) => {
    const totals = refE.map((r) => r[i]).filter((v): v is number => v !== null && v > 0);
    const legsAll = refL.map((r) => r[i]).filter((v): v is number => v !== null && v > 0);
    const leg = myL[i];
    return {
      code: i < cls.controls.length ? cls.controls[i] : '',
      finish: i === cls.controls.length,
      elapsed: e,
      leg,
      legDiff: leg !== null && legsAll.length ? leg - Math.min(...legsAll) : null,
      totalDiff: e !== null && totals.length ? e - Math.min(...totals) : null,
      legRank: leg !== null && legsAll.length ? rank(leg, legsAll) : null,
      totalRank: e !== null && totals.length ? rank(e, totals) : null,
    };
  });
}

/**
 * Maps course points to result rows: returns, for each course point, the row index (controls 0..n-1,
 * finish = n) or -1 for the start, or null when unmatched. Matching is by control code when the course has
 * codes, else by position when the number of controls is the same.
 */
export function mapCourseToResults(course: Course, controls: string[]): (number | null)[] {
  const pts = course.points;
  const ctrl = pts.map((p, i) => ({ p, i })).filter((x) => x.p.kind === 'control');
  const out: (number | null)[] = pts.map((p) =>
    p.kind === 'start' ? -1 : p.kind === 'finish' ? controls.length : null,
  );
  const norm = (s: string | undefined) =>
    (s ?? '')
      .trim()
      .replace(/^0+(?=\d)/, '')
      .toLowerCase();
  const hasCodes = ctrl.some((x) => norm(x.p.code));
  if (hasCodes) {
    // Greedy in-order matching (handles extra or missing controls on either side).
    let k = 0;
    for (const { p, i } of ctrl) {
      const code = norm(p.code);
      if (!code) continue;
      let j = k;
      while (j < controls.length && norm(controls[j]) !== code) j++;
      if (j < controls.length) {
        out[i] = j;
        k = j + 1;
      }
    }
  } else if (ctrl.length === controls.length) {
    ctrl.forEach(({ i }, j) => (out[i] = j));
  }
  return out;
}

/** Runner's start in GPX-clock ms (needs the zone for IOF 2.0 local clock times). */
export function runnerStartMs(c: Competitor, date: string | null, tzOffsetMin: number): number | null {
  if (c.startMs !== null) return c.startMs;
  if (c.startClock === null || !date) return null;
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(day)) return null;
  return day + c.startClock * 1000 - tzOffsetMin * 60_000;
}

/**
 * Guesses the UTC offset (minutes, 15-min steps) of a local start clock time from the GPX: the offset that
 * puts the start inside the track, closest to its beginning. Null if none fits.
 */
export function guessTzOffset(c: Competitor, date: string | null, track: Track): number | null {
  if (c.startMs !== null) return 0;
  if (track.startTime === null || c.startClock === null || !date) return null;
  const t0 = track.startTime;
  const t1 = t0 + track.duration * 1000;
  let best: number | null = null;
  let bestD = Infinity;
  for (let off = -12 * 60; off <= 14 * 60; off += 15) {
    const s = runnerStartMs(c, date, off)!;
    // The start must lie in the track (with a minute of slack); prefer the earliest plausible fit.
    if (s < t0 - 60_000 || s > t1) continue;
    const d = Math.abs(s - t0);
    if (d < bestD) {
      bestD = d;
      best = off;
    }
  }
  return best;
}

/** Punch time (GPX-clock ms) of each course point, or null. */
export function punchTimes(
  map: (number | null)[],
  runner: Competitor,
  startMs: number,
  clockOffsetS: number,
): (number | null)[] {
  const e = elapsedRow(runner);
  return map.map((r) => {
    if (r === null) return null;
    const v = r === -1 ? 0 : e[r];
    return v === null || v === undefined ? null : startMs + (v + clockOffsetS) * 1000;
  });
}

/**
 * Clock offset (s) between the punching system and the GPS that best puts the track at the controls at
 * the punch times: minimises the summed (capped) distance over a ±`range` s search, 1 s then 0.1 s steps.
 */
export function suggestClockOffset(
  course: Course,
  map: (number | null)[],
  runner: Competitor,
  startMs: number,
  track: Track,
  range = 120,
): { offset: number; residuals: (number | null)[] } {
  const base = track.startTime ?? 0;
  const at = punchTimes(map, runner, startMs, 0);
  const cost = (off: number) => {
    let s = 0;
    at.forEach((ms, k) => {
      if (ms === null) return;
      const t = (ms - base) / 1000 + off;
      if (t < 0 || t > track.duration) return void (s += 60);
      s += Math.min(60, segmentDistance(track.positionAt(t), course.points[k]));
    });
    return s;
  };
  let best = 0;
  let bestC = Infinity;
  for (let o = -range; o <= range; o += 1) {
    const c = cost(o);
    if (c < bestC - 1e-9) [best, bestC] = [o, c];
  }
  const coarse = best;
  for (let o = coarse - 1; o <= coarse + 1 + 1e-9; o += 0.1) {
    const c = cost(o);
    if (c < bestC - 1e-9) [best, bestC] = [Math.round(o * 10) / 10, c];
  }
  return { offset: best, residuals: residuals(course, map, runner, startMs, best, track) };
}

/** Distance (m) between the track at each punch time and the course point (null = no punch / outside the track). */
export function residuals(
  course: Course,
  map: (number | null)[],
  runner: Competitor,
  startMs: number,
  offset: number,
  track: Track,
): (number | null)[] {
  const base = track.startTime ?? 0;
  return punchTimes(map, runner, startMs, offset).map((ms, k) => {
    if (ms === null) return null;
    const t = (ms - base) / 1000;
    if (t < 0 || t > track.duration) return null;
    return segmentDistance(track.positionAt(t), course.points[k]);
  });
}

/** `+0:12`, `+1:02:05`; null → `–`. */
export function formatDiff(s: number | null): string {
  if (s === null) return '–';
  const v = Math.round(s);
  const m = Math.floor(v / 60);
  const h = Math.floor(m / 60);
  const ss = String(v % 60).padStart(2, '0');
  return h ? `+${h}:${String(m % 60).padStart(2, '0')}:${ss}` : `+${m}:${ss}`;
}
