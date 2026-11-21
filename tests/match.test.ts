import { describe, expect, it } from 'vitest';
import { appendPoint, emptyCourse, finishAtLast, type Course } from '../src/lib/course/course';
import { candidatesFor, matchCourse } from '../src/lib/course/match';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });
function course(...xy: [number, number][]): Course {
  let c = emptyCourse();
  for (const [n, e] of xy) c = appendPoint(c, at(n, e));
  return finishAtLast(c);
}
/** Track through waypoints [north, east] at 2 m/s, sampled every second. */
function track(...wp: [number, number][]): Track {
  const pts = [pt(wp[0][0], wp[0][1], 0)];
  let t = 0;
  for (let k = 1; k < wp.length; k++) {
    const [n0, e0] = wp[k - 1];
    const [n1, e1] = wp[k];
    const steps = Math.max(1, Math.round(Math.hypot(n1 - n0, e1 - e0) / 2));
    for (let s = 1; s <= steps; s++) pts.push(pt(n0 + ((n1 - n0) * s) / steps, e0 + ((e1 - e0) * s) / steps, ++t));
  }
  return new Track('T', pts);
}
const posN = (tr: Track, t: number) => (tr.positionAt(t).lat - 60) * 111320;

describe('candidates', () => {
  it('one candidate per visit inside the radius', () => {
    const tr = track([0, 0], [0, 400], [0, 0]);
    const c = candidatesFor(tr, at(10, 200), 50);
    expect(c).toHaveLength(2);
    c.forEach((x) => expect(x.d).toBeCloseTo(10, 0));
    expect(c[0].t).toBeCloseTo(100, 0);
    expect(c[1].t).toBeCloseTo(300, 0);
  });
});

describe('matchCourse', () => {
  it('matches a simple course in order', () => {
    const tr = track([0, 0], [200, 0], [200, 200], [0, 200]);
    const c = course([0, 0], [200, 0], [200, 200], [0, 200]);
    const m = matchCourse(tr, c);
    expect(m.map((x) => x.status)).toEqual(['auto', 'auto', 'auto', 'auto']);
    expect(m.map((x) => Math.round(x.t))).toEqual([0, 100, 200, 300]);
  });

  it('picks the later pass when a control is passed on the way to an earlier one', () => {
    // Course S(0,0) → 1 (0,400) → 2 (0,200) → F(0,0). The runner passes control 2 before control 1.
    const tr = track([0, 0], [0, 400], [0, 0]);
    const c = course([0, 0], [0, 400], [0, 200], [0, 0]);
    const m = matchCourse(tr, c);
    expect(Math.round(m[1].t)).toBe(200);
    expect(Math.round(m[2].t)).toBe(300); // not 100
    expect(Math.round(m[3].t)).toBe(400);
  });

  it('butterfly: the same control twice in the course', () => {
    // Centre (0,0) visited at the start of each loop: S(−100,0) → C(0,0) → A(100,0) → C → B(0,100) → F(0,0)
    const tr = track([-100, 0], [0, 0], [100, 0], [0, 0], [0, 100], [0, 0]);
    const c = course([-100, 0], [0, 0], [100, 0], [0, 0], [0, 100], [0, 0]);
    const m = matchCourse(tr, c);
    expect(m.map((x) => Math.round(x.t))).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it('a missed control is "not found" with an estimated time; GPS offset within the radius still matches', () => {
    const tr = track([0, 0], [200, 30], [400, 0]); // passes control at (200,0) 30 m off
    const c = course([0, 0], [200, 0], [300, 400], [400, 0]);
    const m = matchCourse(tr, c);
    expect(m[1].status).toBe('auto');
    expect(m[1].distance).toBeGreaterThan(25);
    expect(m[2].status).toBe('not-found');
    expect(m[2].t).toBeGreaterThanOrEqual(m[1].t);
    expect(m[2].t).toBeLessThanOrEqual(m[3].t);
  });

  it('start/finish fall back to track start/end; manual times are respected', () => {
    const tr = track([0, 0], [0, 400]);
    const c = course([0, -300], [0, 200], [0, 900]);
    const m = matchCourse(tr, c);
    expect(m[0].status).toBe('start-of-track');
    expect(m[2].status).toBe('end-of-track');
    const id = c.points[1].id;
    const mm = matchCourse(tr, c, { overrides: { [id]: 120 } });
    expect(mm[1]).toMatchObject({ status: 'manual', t: 120 });
    expect(posN(tr, 120)).toBeCloseTo(0, 6);
  });

  it('is fast enough for 2 h and 40 controls', () => {
    const wp: [number, number][] = [];
    for (let k = 0; k <= 40; k++) wp.push([Math.sin(k) * 400, k * 180]);
    const tr = track(...wp);
    const c = course(...wp);
    const t0 = performance.now();
    const m = matchCourse(tr, c);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(m.filter((x) => x.status === 'auto').length).toBeGreaterThanOrEqual(40);
  });
});
