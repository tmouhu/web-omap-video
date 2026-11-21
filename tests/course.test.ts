import { describe, expect, it } from 'vitest';
import {
  appendPoint,
  courseLength,
  courseProblems,
  emptyCourse,
  finishAtLast,
  insertControl,
  legLabel,
  legs,
  pointLabel,
  removePoint,
  reorderControl,
  type Course,
} from '../src/lib/course/course';
import { bestLabelAngle } from '../src/lib/render/overprint';
import { M_LAT, pt } from './helpers';

const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });

function build(...xy: [number, number][]): Course {
  let c = emptyCourse('Test');
  for (const [n, e] of xy) c = appendPoint(c, at(n, e));
  return finishAtLast(c);
}

describe('course model', () => {
  it('validates start, controls and finish', () => {
    expect(courseProblems(null)).toHaveLength(1);
    let c = appendPoint(emptyCourse(), at(0, 0));
    expect(courseProblems(c).join()).toMatch(/finish/);
    c = build([0, 0], [100, 0], [200, 0]);
    expect(courseProblems(c)).toEqual([]);
    expect(c.points.map((p) => p.kind)).toEqual(['start', 'control', 'finish']);
    expect(finishAtLast(build([0, 0], [10, 0]))).toBeDefined(); // fewer than 3 points: no finish
    expect(courseProblems(finishAtLast(appendPoint(appendPoint(emptyCourse(), at(0, 0)), at(9, 9))))).not.toEqual([]);
  });

  it('labels, legs and lengths', () => {
    const c = build([0, 0], [100, 0], [100, 100], [0, 100]);
    expect(c.points.map((_, i) => pointLabel(c, i))).toEqual(['S', '1', '2', 'F']);
    expect(legLabel(c, 0)).toBe('S → 1');
    expect(legLabel(c, 2)).toBe('2 → F');
    expect(legs(c)).toHaveLength(3);
    expect(courseLength(c)).toBeCloseTo(300, -0.5);
  });

  it('adding after the finish inserts before it; insert, reorder, remove', () => {
    let c = build([0, 0], [100, 0], [200, 0]);
    c = appendPoint(c, at(300, 0));
    expect(c.points.map((p) => p.kind)).toEqual(['start', 'control', 'control', 'finish']);
    c = insertControl(c, 1, at(50, 0));
    expect((c.points[1].lat - 60) * M_LAT).toBeCloseTo(50, 0);
    const id2 = c.points[2].id;
    c = reorderControl(c, id2, -1);
    expect(c.points[1].id).toBe(id2);
    expect(reorderControl(c, c.points[1].id, -1).points[0].kind).toBe('start'); // cannot pass the start
    c = removePoint(c, id2);
    expect(c.points).toHaveLength(4);
  });
});

describe('control number placement', () => {
  it('opposite a single leg, and in the widest gap between two legs', () => {
    expect(bestLabelAngle([0])).toBeCloseTo(Math.PI, 9);
    // Legs to the east (0) and south (π/2): widest gap is centred at 5π/4 (north-west).
    expect(bestLabelAngle([0, Math.PI / 2])).toBeCloseTo((5 * Math.PI) / 4, 9);
  });
});
