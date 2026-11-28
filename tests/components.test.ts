import { describe, expect, it } from 'vitest';
import {
  currentLeg,
  defaultComponents,
  elapsedDistanceText,
  elapsedTimeText,
  elevationProfile,
  hrZone,
  isAvailable,
  splitsVisibility,
  DEFAULT_COMPONENT_OPTIONS,
  type SplitEvent,
} from '../src/lib/components/components';
import type { SplitRow } from '../src/lib/results/splits';
import { firstFrameClock, resolveRange, DEFAULT_EXPORT_RANGE } from '../src/lib/export/range';
import { parseDuration } from '../src/lib/format';
import { Track } from '../src/lib/track/track';
import { pt, T0 } from './helpers';

// 1 km north in 400 s with elevation going up 0 → 40 m and HR 120 → 160.
const pts = Array.from({ length: 401 }, (_, i) => pt(i * 2.5, 0, i, { ele: i / 10, hr: 120 + i / 10 }));
const track = new Track('T', pts);
const data = (t: number, origin = 0, passings: number[] | null = null) => ({
  track,
  t,
  rangeStart: 0,
  rangeEnd: 400,
  origin,
  passings,
});

describe('component values', () => {
  it('elapsed time from the origin, with countdown or zero before it', () => {
    expect(elapsedTimeText(data(130, 10), DEFAULT_COMPONENT_OPTIONS)).toBe('2:00');
    expect(elapsedTimeText(data(5, 10), DEFAULT_COMPONENT_OPTIONS)).toBe('-0:05');
    expect(elapsedTimeText(data(5, 10), { ...DEFAULT_COMPONENT_OPTIONS, beforeStart: 'zero' })).toBe('0:00');
  });

  it('elapsed distance: metres below 1 km, km with 2 decimals from 1 km', () => {
    expect(elapsedDistanceText(data(100))).toMatch(/^25\d m$/);
    expect(elapsedDistanceText(data(400))).toBe('1.00 km');
    expect(elapsedDistanceText(data(100, 100))).toBe('0 m');
  });

  it('heart rate zones and current leg', () => {
    expect(hrZone(110, [120, 140, 155, 170])).toBe(0);
    expect(hrZone(150, [120, 140, 155, 170])).toBe(2);
    expect(hrZone(190, [120, 140, 155, 170])).toBe(4);
    expect(currentLeg(data(150, 0, [0, 100, 300, 400]))).toEqual([100, 300]);
    expect(currentLeg(data(150, 0, null))).toBeNull();
  });

  it('elevation profile: smoothed, spans the range, total ascent', () => {
    const p = elevationProfile(track, 0, 400, 'distance');
    expect(p.x[0]).toBe(0);
    expect(p.x[p.x.length - 1]).toBeCloseTo(1000, -0.5);
    expect(p.max - p.min).toBeGreaterThan(38);
    expect(p.ascent).toBeCloseTo(p.max - p.min, 0);
    expect(elevationProfile(track, 0, 400, 'distance')).toBe(p); // cached
  });

  it('availability depends on GPX channels', () => {
    expect(isAvailable('heartRate', track)).toBe(true);
    const plain = new Track('P', [pt(0, 0, 0), pt(10, 0, 5)]);
    expect(isAvailable('heartRate', plain)).toBe(false);
    expect(isAvailable('elevation', plain)).toBe(false);
    expect(isAvailable('pace', plain)).toBe(true);
    expect(defaultComponents().every((c) => !c.enabled)).toBe(true);
  });

  it('titles are off by default on the single-value components', () => {
    const label = Object.fromEntries(defaultComponents().map((c) => [c.kind, c.style.showLabel]));
    expect(label).toEqual({
      elevation: true,
      pace: false,
      heartRate: false,
      time: false,
      distance: false,
      splits: true,
    });
  });
});

describe('export range (STORY-35)', () => {
  it('course start → finish, falling back to the whole track without a course', () => {
    expect(resolveRange(DEFAULT_EXPORT_RANGE, track, [20, 200, 390])).toEqual({
      start: 20,
      end: 390,
      origin: 20,
      mode: 'course',
    });
    expect(resolveRange(DEFAULT_EXPORT_RANGE, track, null)).toMatchObject({ start: 0, end: 400, mode: 'track' });
  });

  it('custom range with lead-in/out; origin stays at the unpadded start', () => {
    const r = resolveRange({ mode: 'custom', in: 300, out: 100, padBefore: 10, padAfter: 5 }, track, null);
    expect(r).toEqual({ start: 90, end: 305, origin: 100, mode: 'custom' });
    expect(firstFrameClock(track, r)).toBe(T0 + 90_000);
  });
});

describe('parseDuration', () => {
  it.each([
    ['75', 75],
    ['1:15', 75],
    ['1:02:05', 3725],
    ['-0:12', -12],
    ['2:30.5', 150.5],
  ])('%s → %s', (s, v) => expect(parseDuration(s)).toBe(v));
  it.each(['', 'x', '1:75', '1::2'])('rejects %j', (s) => expect(parseDuration(s)).toBeNull());
});

describe('splits component visibility', () => {
  const row = (finish = false): SplitRow => ({
    code: finish ? '' : '31',
    finish,
    elapsed: 60,
    leg: 60,
    legDiff: 2,
    totalDiff: 2,
    legRank: 2,
    totalRank: 2,
  });
  const events: SplitEvent[] = [
    { t: 100, number: 1, row: row() },
    { t: 103, number: 2, row: row() },
    { t: 200, number: 3, row: row(true) },
  ];
  const o = { ...DEFAULT_COMPONENT_OPTIONS, splitFadeIn: 0.5, splitShow: 4, splitFadeOut: 1, splitShowFinish: 8 };
  const at = (t: number, timeScale = 1) => splitsVisibility({ ...data(t), splits: events, timeScale }, o);

  it('hidden before the first passing and after the fade-out', () => {
    expect(at(99)).toBeNull();
    expect(at(150)).toBeNull();
    expect(splitsVisibility({ ...data(100), splits: null }, o)).toBeNull();
  });

  it('fades in, stays for the display time, fades out (video seconds)', () => {
    expect(at(200.25)!.alpha).toBeCloseTo(0.5);
    expect(at(202)!.alpha).toBe(1);
    expect(at(208.5 + 0.5)!.alpha).toBeCloseTo(0.5); // finish: 0.5 + 8 s, then half of the 1 s fade
    expect(at(209.6)).toBeNull();
    // At 2× speed the same video durations span twice the track time.
    expect(at(200.5, 2)!.alpha).toBeCloseTo(0.5);
    expect(at(218, 2)!.alpha).toBeCloseTo(0.5);
  });

  it('a later passing replaces the current one', () => {
    expect(at(102)!.event.number).toBe(1);
    expect(at(103.5)!.event.number).toBe(2);
  });

  it('available only with split data', () => {
    expect(isAvailable('splits', track)).toBe(false);
    expect(isAvailable('splits', track, true)).toBe(true);
    expect(isAvailable('splits', null, true)).toBe(false);
  });
});
