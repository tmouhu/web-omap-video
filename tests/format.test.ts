import { describe, expect, it } from 'vitest';
import { formatDistance, formatDuration, formatPace, formatScale } from '../src/lib/format';

describe('format', () => {
  it('durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3599.6)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-12)).toBe('-0:12');
  });
  it('distances switch to km at 1 km, without "1000 m"', () => {
    expect(formatDistance(840.4)).toBe('840 m');
    expect(formatDistance(999.4)).toBe('999 m');
    expect(formatDistance(999.6)).toBe('1.00 km');
    expect(formatDistance(1237)).toBe('1.24 km');
    expect(formatDistance(1237, ',')).toBe('1,24 km');
  });
  it('pace and scale', () => {
    expect(formatPace(342)).toBe('5:42 /km');
    expect(formatPace(null)).toBe('–:– /km');
    expect(formatScale(10004)).toBe('1:10 000');
    expect(formatScale(950)).toBe('1:950');
  });
});
