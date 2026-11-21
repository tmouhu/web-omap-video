import { describe, expect, it } from 'vitest';
import {
  currentLeg,
  defaultComponents,
  elapsedDistanceText,
  elapsedTimeText,
  elevationProfile,
  hrZone,
  isAvailable,
  DEFAULT_COMPONENT_OPTIONS,
} from '../src/lib/components/components';
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
