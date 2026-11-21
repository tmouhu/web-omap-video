import { describe, expect, it } from 'vitest';
import { appendPoint, emptyCourse, finishAtLast, insertControl } from '../src/lib/course/course';
import {
  formatRouteLength,
  legIndexOf,
  nextLabelAndColor,
  orphanRoutes,
  routeLength,
  routesForLeg,
  ROUTE_COLORS,
  type RouteChoice,
} from '../src/lib/course/routes';
import { paceColor } from '../src/lib/render/scene';
import { pt } from './helpers';

const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });

describe('route choices', () => {
  let c = emptyCourse();
  for (const [n, e] of [
    [0, 0],
    [300, 0],
    [300, 300],
  ] as [number, number][])
    c = appendPoint(c, at(n, e));
  c = finishAtLast(c);
  const r: RouteChoice = {
    id: 'r1',
    fromId: c.points[0].id,
    toId: c.points[1].id,
    label: 'A',
    color: ROUTE_COLORS[0],
    points: [at(0, 0), at(150, 100), at(300, 0)],
  };

  it('belongs to its leg by point ids, survives inserts elsewhere, orphans when the leg is split', () => {
    expect(legIndexOf(c, r)).toBe(0);
    expect(routesForLeg([r], c, 0)).toHaveLength(1);
    expect(routesForLeg([r], c, 1)).toHaveLength(0);
    const c2 = insertControl(c, 2, at(300, 150)); // insert in leg 1 → leg 0 unchanged
    expect(legIndexOf(c2, r)).toBe(0);
    const c3 = insertControl(c, 1, at(150, 0)); // split leg 0
    expect(orphanRoutes([r], c3)).toHaveLength(1);
  });

  it('length is geodesic; formatting rounds to 5 m below 1 km, 2 decimals above', () => {
    expect(routeLength(r)).toBeCloseTo(2 * Math.hypot(150, 100), -0.5);
    expect(formatRouteLength(637)).toBe('635 m');
    expect(formatRouteLength(638)).toBe('640 m');
    expect(formatRouteLength(998)).toBe('1.00 km');
    expect(formatRouteLength(1237)).toBe('1.24 km');
  });

  it('next label and colour', () => {
    expect(nextLabelAndColor([])).toEqual({ label: 'A', color: ROUTE_COLORS[0] });
    expect(nextLabelAndColor([r]).label).toBe('B');
  });
});

describe('pace colours', () => {
  it('green when fast, yellow around the median, red when slow or stopped', () => {
    expect(paceColor(300 * 0.8, 300)).toBe('rgb(26, 150, 65)');
    expect(paceColor(300 * 1.15, 300)).toBe('rgb(250, 200, 30)');
    expect(paceColor(300 * 2, 300)).toBe('rgb(215, 25, 28)');
    expect(paceColor(null, 300)).toBe('rgb(215, 25, 28)');
  });
});
