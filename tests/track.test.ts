import { describe, expect, it } from 'vitest';
import { angleDiff } from '../src/lib/geo/geo';
import { FALLBACK_SPEED, Track } from '../src/lib/track/track';
import { M_LAT, pt } from './helpers';

describe('Track', () => {
  // 100 m north in 50 s, then 100 m east in 50 s.
  const track = new Track('L', [pt(0, 0, 0), pt(100, 0, 50), pt(100, 100, 100)]);

  it('derives duration, length and channels', () => {
    expect(track.duration).toBe(100);
    expect(track.length).toBeCloseTo(200, -0.5);
    expect(track.channels).toEqual({ time: true, elevation: false, heartRate: false, cadence: false });
  });

  it('interpolates position by time and clamps outside range', () => {
    expect((track.positionAt(25).lat - 60) * M_LAT).toBeCloseTo(50, 0);
    expect(track.positionAt(-10).t).toBe(0);
    expect(track.positionAt(1e6).t).toBe(100);
    expect(track.indexAt(1e6)).toBe(2);
  });

  it('raw heading follows legs and averages through corners', () => {
    expect(track.rawHeadingAt(20)).toBeCloseTo(0, 0);
    expect(track.rawHeadingAt(80)).toBeCloseTo(90, 0);
    expect(track.rawHeadingAt(50)).toBeCloseTo(45, 0);
  });

  it('smoothed heading is deterministic, follows legs, and turns the short way', () => {
    expect(Math.abs(angleDiff(0, track.headingAt(15)))).toBeLessThan(2);
    expect(Math.abs(angleDiff(90, track.headingAt(85)))).toBeLessThan(2);
    const h = track.headingAt(50);
    expect(h).toBeGreaterThan(20);
    expect(h).toBeLessThan(70);
    expect(track.headingAt(37.3)).toBe(
      new Track('L', [pt(0, 0, 0), pt(100, 0, 50), pt(100, 100, 100)]).headingAt(37.3),
    );
  });

  it('crosses north the short way (350° → 10°)', () => {
    const r = (deg: number, m: number) => [Math.cos((deg * Math.PI) / 180) * m, Math.sin((deg * Math.PI) / 180) * m];
    const [n1, e1] = r(350, 100);
    const [n2, e2] = r(10, 100);
    const t = new Track('W', [pt(0, 0, 0), pt(n1, e1, 50), pt(n1 + n2, e1 + e2, 100)]);
    for (let s = 0; s <= 100; s += 1) {
      const d = Math.abs(angleDiff(0, t.headingAt(s)));
      expect(d).toBeLessThan(11);
    }
  });

  it('ignores GPS jitter in heading', () => {
    const pts = [];
    for (let i = 0; i <= 60; i++) pts.push(pt(i * 3, i % 2 ? 1.5 : -1.5, i));
    const zig = new Track('Z', pts);
    expect(Math.abs(angleDiff(0, zig.rawHeadingAt(30)!))).toBeLessThan(5);
    expect(Math.abs(angleDiff(0, zig.headingAt(30)))).toBeLessThan(5);
  });

  it('does not spin during a stop (distance-based chord spans the stop)', () => {
    const t = new Track('S', [pt(0, 0, 0), pt(0, 100, 40), pt(0, 100, 100), pt(0, 200, 140)]);
    for (const s of [45, 70, 95]) expect(Math.abs(angleDiff(90, t.headingAt(s)))).toBeLessThan(1);
  });

  it('raw heading is null when the whole track is stationary, smoothed heading stays defined', () => {
    const still = new Track('Z', [pt(0, 0, 0), pt(0, 0, 60)]);
    expect(still.rawHeadingAt(30)).toBeNull();
    expect(still.headingAt(30)).toBe(0);
  });

  it('synthesizes timing when timestamps are missing', () => {
    const t = new Track('N', [pt(0, 0, null), pt(300, 0, null)]);
    expect(t.channels.time).toBe(false);
    expect(t.startTime).toBeNull();
    expect(t.duration).toBeCloseTo(300 / FALLBACK_SPEED, 0);
  });

  it('never lets time run backwards', () => {
    const t = new Track('B', [pt(0, 0, 0), pt(10, 0, 10), pt(20, 0, 5), pt(30, 0, 20)]);
    expect(t.points.map((p) => p.t)).toEqual([0, 10, 10, 20]);
  });

  it('pace, heart rate and elevation', () => {
    const t = new Track('P', [
      pt(0, 0, 0, { hr: 100, ele: 10 }),
      pt(250, 0, 60, { hr: 160, ele: 20 }),
      pt(250, 0, 120, { hr: 120, ele: 20 }),
    ]);
    expect(t.paceAt(30)!).toBeCloseTo(240, -0.5); // 250 m / 60 s → 4:00 /km
    expect(t.paceAt(100)).toBeNull(); // standing still
    expect(t.heartRateAt(30)).toBeCloseTo(130, 6);
    expect(t.elevationAt(30)).toBeCloseTo(15, 6);
    expect(t.channels.heartRate).toBe(true);
  });
});

describe('arrow heading (STORY-43)', () => {
  // 90° corner: 200 m north then 200 m east at 4 m/s, one GPS point per second; corner at t = 50 s.
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const d = i * 4;
    pts.push(d <= 200 ? pt(d, 0, i) : pt(200, d - 200, i));
  }
  const corner = new Track('C', pts);

  it('turns at the corner with the normal profile', () => {
    expect(Math.abs(angleDiff(0, corner.arrowHeadingAt(48, 'normal')))).toBeLessThan(15); // 8 m before
    expect(Math.abs(angleDiff(0, corner.arrowHeadingAt(52, 'normal')))).toBeGreaterThan(75); // 8 m after
  });

  it('smooth profile is the calm camera heading; the camera heading is unchanged', () => {
    for (const s of [40, 45, 50, 55, 60]) expect(corner.arrowHeadingAt(s, 'smooth')).toBe(corner.headingAt(s));
    // The camera heading still rounds the corner widely (it starts turning well before it).
    expect(Math.abs(angleDiff(0, corner.headingAt(46)))).toBeGreaterThan(2);
  });

  it('stays stable with GPS jitter (±2 m point-to-point noise)', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const noisy = [];
    for (let i = 0; i <= 120; i++) noisy.push(pt(i * 4 + rnd() * 2, rnd() * 2, i));
    const tr = new Track('N', noisy);
    let maxStep = 0;
    for (let s = 5; s < 115; s += 1 / 30) {
      expect(Math.abs(angleDiff(0, tr.arrowHeadingAt(s, 'normal')))).toBeLessThan(20);
      maxStep = Math.max(maxStep, Math.abs(angleDiff(tr.arrowHeadingAt(s - 1 / 30), tr.arrowHeadingAt(s))));
    }
    expect(maxStep).toBeLessThan(8);
  });
});
