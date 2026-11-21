// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyEdits, deleteEditsFor, findOutliers } from '../src/lib/gpx/edits';
import { parseGpx } from '../src/lib/gpx/gpx';
import { writeGpx } from '../src/lib/gpx/write';
import { M_LAT, pt } from './helpers';

const line = () => Array.from({ length: 11 }, (_, i) => pt(i * 10, 0, i * 5, { hr: 100 + i }));
const north = (p: { lat: number }) => (p.lat - 60) * M_LAT;

describe('GPX edits', () => {
  it('move with radius moves neighbours with falloff; times never change', () => {
    const pts = line();
    const target = pt(50, 20, 0);
    const out = applyEdits(pts, [{ type: 'move', index: 5, lat: target.lat, lon: target.lon, radius: 25 }]);
    expect(out[5].lon).toBeCloseTo(target.lon, 12);
    expect(out[4].lon).toBeGreaterThan(pts[4].lon);
    expect(out[4].lon).toBeLessThan(target.lon);
    expect(out[2].lon).toBe(pts[2].lon); // 30 m away
    expect(out.map((p) => p.time)).toEqual(pts.map((p) => p.time));
  });

  it('delete, trim and shift', () => {
    const pts = line();
    expect(applyEdits(pts, [{ type: 'delete', from: 2, to: 4 }])).toHaveLength(8);
    const tr = applyEdits(pts, [{ type: 'trim', from: 3, to: 7 }]);
    expect(tr).toHaveLength(5);
    expect(tr[0].time).toBe(pts[3].time);
    const sh = applyEdits(pts, [{ type: 'shift', from: 0, to: 1, dLat: 1e-4, dLon: 0 }]);
    expect(sh[0].lat - pts[0].lat).toBeCloseTo(1e-4, 12);
    expect(sh[2].lat).toBe(pts[2].lat);
  });

  it('redraw spreads times by distance and keeps both end times', () => {
    const pts = line();
    const out = applyEdits(pts, [{ type: 'redraw', from: 2, to: 6, path: [pt(30, 30, 0), pt(50, 30, 0)] }]);
    // 2 + (start, 2 drawn, end) + 4 = 10 points
    expect(out).toHaveLength(10);
    expect(out[2].time).toBe(pts[2].time);
    expect(out[5].time).toBe(pts[6].time);
    expect(out[3].time!).toBeGreaterThan(pts[2].time!);
    expect(out[4].time!).toBeLessThan(pts[6].time!);
    expect(out[3].hr).toBeGreaterThan(102);
  });

  it('finds GPS spikes and deletes them', () => {
    const pts = line();
    pts[6] = { ...pts[6], lon: pts[6].lon + 0.003 }; // ~170 m spike in 5 s
    const o = findOutliers(pts);
    expect(o).toEqual([6]);
    const out = applyEdits(pts, deleteEditsFor(o));
    expect(out).toHaveLength(10);
    expect(findOutliers(out)).toEqual([]);
    expect(deleteEditsFor([2, 3, 7])).toEqual([
      { type: 'delete', from: 7, to: 7 },
      { type: 'delete', from: 2, to: 3 },
    ]);
  });

  it('writes GPX that parses back with time, HR', () => {
    const pts = line();
    const g = parseGpx(writeGpx('Edited <run>', pts));
    expect(g.name).toBe('Edited <run>');
    expect(g.points).toHaveLength(11);
    expect(g.points[3].time).toBe(pts[3].time);
    expect(g.points[3].hr).toBe(103);
    expect(north(g.points[10])).toBeCloseTo(100, 1);
  });
});
