import { describe, expect, it } from 'vitest';
import { forward, pointScale } from '../src/lib/geo/crs';
import { DEFAULT_FREE_MODE, Timeline } from '../src/lib/anim/timeline';
import { groundResolutionForScale } from '../src/lib/geo/geo';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

/** Free mode without rotation smoothing (camera = raw grid heading). */
const RAW = { ...DEFAULT_FREE_MODE, rotationDeadband: 0, rotationSmoothing: 0 };
const track = new Track('L', [pt(0, 0, 0), pt(200, 0, 100), pt(200, 200, 200)]);

describe('Timeline (free mode)', () => {
  it('centres on the position without look-ahead and is deterministic', () => {
    const tl = new Timeline(track, 'EPSG:3067', { ...RAW, scale: 10000, headingUp: false, lookAhead: 0 });
    const f = tl.frameStateAt(50, { width: 1000, height: 600 });
    const xy = forward('EPSG:3067', track.positionAt(50));
    expect(f.view.center[0]).toBeCloseTo(xy[0], 6);
    expect(f.view.center[1]).toBeCloseTo(xy[1], 6);
    expect(f.view.rotation).toBeCloseTo(0, 9);
    expect(tl.frameStateAt(50, { width: 1000, height: 600 })).toEqual(f);
  });

  it('heading-up rotation uses the grid heading (true heading + convergence)', () => {
    const tl = new Timeline(track, 'EPSG:3067', { ...RAW, scale: 10000, headingUp: true, lookAhead: 0 });
    const f = tl.frameStateAt(40, { width: 1000, height: 600 }); // running true north at 25°E, west of TM35's 27°E meridian
    expect(f.gridHeading).toBeGreaterThan(1.5);
    expect(f.gridHeading).toBeLessThan(2);
    expect(f.view.rotation).toBeCloseTo(-(f.gridHeading * Math.PI) / 180, 9);
  });

  it('north-up uses the map north rotation (raster map), look-ahead along it', () => {
    const north = (-10 * Math.PI) / 180; // map north 10° east of grid north
    const tl = new Timeline(
      track,
      'EPSG:3067',
      { ...RAW, scale: 10000, headingUp: false, lookAhead: 0.2 },
      null,
      north,
    );
    const f = tl.frameStateAt(50, { width: 1000, height: 500 });
    expect(f.view.rotation).toBeCloseTo(north, 9);
    const off = 0.2 * 500 * tl.resolution;
    expect(f.view.center[0] - f.positionXY[0]).toBeCloseTo(Math.sin(-north) * off, 6);
    expect(f.view.center[1] - f.positionXY[1]).toBeCloseTo(Math.cos(-north) * off, 6);
    // Heading-up ignores it.
    const hu = new Timeline(track, 'EPSG:3067', { ...RAW, scale: 10000, headingUp: true, lookAhead: 0 }, null, north);
    expect(hu.frameStateAt(40, { width: 1000, height: 600 }).view.rotation).not.toBeCloseTo(north, 3);
  });

  it('look-ahead puts the runner below the centre along the heading', () => {
    const tl = new Timeline(track, 'EPSG:3067', { ...RAW, scale: 10000, headingUp: true, lookAhead: 0.2 });
    const f = tl.frameStateAt(150, { width: 1000, height: 500 }); // running east
    const off = 0.2 * 500 * tl.resolution;
    expect(f.view.center[0] - f.positionXY[0]).toBeCloseTo(off, 0);
  });

  it('resolution shows the requested scale (ground metres per CSS px)', () => {
    const tl = new Timeline(track, 'EPSG:3857', { ...RAW, scale: 10000, headingUp: false, lookAhead: 0 });
    expect(tl.resolution / pointScale('EPSG:3857', track.center())).toBeCloseTo(groundResolutionForScale(10000), 9);
    expect(tl.resolution).toBeCloseTo(groundResolutionForScale(10000) * 1.995, 1);
  });
});

describe('free-mode rotation smoothing', () => {
  // North for 400 m with ±8° zig-zags every 20 m, then a sustained 90° turn east for 400 m (2 m/s).
  const pts = [pt(0, 0, 0)];
  let n = 0;
  let e = 0;
  let t = 0;
  for (let k = 1; k <= 20; k++) {
    n += 20;
    e += k % 2 ? 2.8 : -2.8;
    t += 10;
    pts.push(pt(n, e, t));
  }
  for (let k = 1; k <= 20; k++) {
    e += 20;
    t += 10;
    pts.push(pt(n, e, t));
  }
  const zig = new Track('Z', pts);
  const frame = { width: 1000, height: 600 };
  const rot = (tl: Timeline, tt: number) => (-tl.frameStateAt(tt, frame).view.rotation * 180) / Math.PI;
  const spread = (tl: Timeline, a: number, b: number) => {
    const v: number[] = [];
    for (let x = a; x <= b; x += 1) v.push(rot(tl, x));
    return Math.max(...v) - Math.min(...v);
  };

  it('small direction changes do not turn the map, a sustained turn does', () => {
    const raw = new Timeline(zig, 'EPSG:3067', { ...RAW, lookAhead: 0 });
    const smooth = new Timeline(zig, 'EPSG:3067', { ...DEFAULT_FREE_MODE, lookAhead: 0 });
    expect(spread(raw, 30, 170)).toBeGreaterThan(5);
    expect(spread(smooth, 30, 170)).toBeLessThan(2);
    // After the turn the camera faces east (grid ≈ 90° − convergence).
    expect(rot(smooth, 380)).toBeGreaterThan(80);
    expect(rot(smooth, 380)).toBeLessThan(95);
  });

  it('is deterministic and calmer at higher playback speed', () => {
    const a = new Timeline(zig, 'EPSG:3067', DEFAULT_FREE_MODE, null, 0, 1);
    const b = new Timeline(zig, 'EPSG:3067', DEFAULT_FREE_MODE, null, 0, 1);
    expect(b.frameStateAt(300, frame)).toEqual(a.frameStateAt(300, frame)); // no history / call-order effects
    const fast = new Timeline(zig, 'EPSG:3067', DEFAULT_FREE_MODE, null, 0, 10);
    const rate = (tl: Timeline) => {
      let m = 0;
      for (let x = 150; x < 300; x += 1) m = Math.max(m, Math.abs(rot(tl, x + 1) - rot(tl, x)));
      return m;
    };
    expect(rate(fast)).toBeLessThan(rate(a));
  });
});
