import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  bearing,
  distance,
  geodesicDistance,
  gridBearing,
  groundResolutionForScale,
  normalizeAngle,
  polylineLength,
  scaleForGroundResolution,
  segmentDistance,
} from '../src/lib/geo/geo';

describe('geo', () => {
  const hki = { lat: 60.1699, lon: 24.9384 };
  const tku = { lat: 60.4518, lon: 22.2666 };

  it('geodesic distance matches the WGS84 reference (Helsinki–Turku ≈ 150.6 km)', () => {
    const s = geodesicDistance(hki, tku);
    expect(s / 1000).toBeGreaterThan(150);
    expect(s / 1000).toBeLessThan(151.5);
    expect(Math.abs(distance(hki, tku) - s) / s).toBeLessThan(0.005);
  });

  it('segmentDistance agrees with the geodesic within 0.01 % for short steps', () => {
    const b = { lat: hki.lat + 0.003, lon: hki.lon + 0.004 };
    expect(Math.abs(segmentDistance(hki, b) / geodesicDistance(hki, b) - 1)).toBeLessThan(1e-4);
  });

  it('polyline length sums segments', () => {
    const mid = { lat: 60.3, lon: 23.6 };
    expect(polylineLength([hki, mid, tku])).toBeCloseTo(geodesicDistance(hki, mid) + geodesicDistance(mid, tku), 6);
  });

  it('bearings', () => {
    expect(bearing({ lat: 60, lon: 25 }, { lat: 61, lon: 25 })).toBeCloseTo(0, 6);
    expect(bearing({ lat: 60, lon: 25 }, { lat: 60, lon: 25.001 })).toBeCloseTo(90, 2);
    expect(gridBearing(0, -1)).toBeCloseTo(180);
    expect(gridBearing(-1, 0)).toBeCloseTo(270);
  });

  it('angle helpers wrap correctly', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('scale ↔ resolution at 96 CSS px/inch', () => {
    expect(groundResolutionForScale(10000)).toBeCloseTo(2.6458, 4);
    expect(scaleForGroundResolution(groundResolutionForScale(15000))).toBeCloseTo(15000, 6);
  });
});
