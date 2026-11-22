// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appendPoint, emptyCourse, finishAtLast, type Course } from '../src/lib/course/course';
import { isResultListXml, parseClockText, parseResultList } from '../src/lib/results/results';
import {
  compareSplits,
  formatDiff,
  guessTzOffset,
  mapCourseToResults,
  punchTimes,
  runnerStartMs,
  suggestClockOffset,
} from '../src/lib/results/splits';
import { Track } from '../src/lib/track/track';
import { pt, T0 } from './helpers';

const V2 = readFileSync('tests/fixtures/results-v2.xml', 'utf8');
const V3 = readFileSync('tests/fixtures/results-v3.xml', 'utf8');

describe('IOF XML result lists', () => {
  it('detects result lists', () => {
    expect(isResultListXml(V2)).toBe(true);
    expect(isResultListXml(V3)).toBe(true);
    expect(isResultListXml('<?xml version="1.0"?><CourseData/>')).toBe(false);
  });

  it('parses clock texts', () => {
    expect(parseClockText('00:17:11')).toBe(1031);
    expect(parseClockText('01:31')).toBe(91);
    expect(parseClockText('')).toBeNull();
    expect(parseClockText('x')).toBeNull();
  });

  it('parses IOF 3.0 with missing punches as nulls and absolute starts', () => {
    const f = parseResultList(V3);
    expect(f.version).toBe('3.0');
    expect(f.event).toBe('Test Sprint');
    expect(f.date).toBe('2026-01-01');
    expect(f.classes.map((c) => c.name)).toEqual(['Short', 'Long (A)']);
    const c = f.classes[1];
    expect(c.controls).toEqual(['77', '61', '62']);
    expect(c.competitors[0]).toMatchObject({
      name: 'Runner A',
      club: 'Club 1',
      status: 'OK',
      position: 1,
      startMs: T0 + 600_000,
      startClock: null,
      splits: [46, 91, 114],
      finish: 150,
    });
    expect(c.competitors[2].splits).toEqual([50, null, 130]);
    expect(c.competitors[3]).toMatchObject({ status: 'DidNotFinish', splits: [60, 110, null], finish: null });
  });

  it('parses IOF 2.0.3 (omitted missing punches, local clock starts) to the same splits', () => {
    const a = parseResultList(V2);
    const b = parseResultList(V3);
    expect(a.version).toBe('2.0.3');
    expect(a.classes[1].controls).toEqual(b.classes[1].controls);
    a.classes[1].competitors.forEach((c, i) => {
      const o = b.classes[1].competitors[i];
      expect(c.name).toBe(o.name);
      expect(c.splits).toEqual(o.splits);
      expect(c.finish).toBe(o.finish);
    });
    expect(a.classes[1].competitors[0]).toMatchObject({ startMs: null, startClock: 2 * 3600 + 600 });
    expect(a.classes[1].competitors[2].status).toBe('Disqualified');
  });

  it('rejects other XML', () => {
    expect(() => parseResultList('<?xml version="1.0"?><CourseData/>')).toThrow();
  });
});

describe('split comparison', () => {
  const cls = parseResultList(V3).classes[1];

  it('leg and total difference to the best of the OK competitors', () => {
    const rows = compareSplits(cls, 1); // Runner B: 45, 89, 121, 160
    expect(rows.map((r) => r.code)).toEqual(['77', '61', '62', '']);
    expect(rows[3].finish).toBe(true);
    expect(rows.map((r) => r.leg)).toEqual([45, 44, 32, 39]);
    // Best legs (A, B): 45, 44, 23, 36. Best totals: 45, 89, 114, 150.
    expect(rows.map((r) => r.legDiff)).toEqual([0, 0, 9, 3]);
    expect(rows.map((r) => r.totalDiff)).toEqual([0, 0, 7, 10]);
    expect(rows.map((r) => r.totalRank)).toEqual([1, 1, 2, 2]);
  });

  it('missing punch: no leg times next to it, totals still compared', () => {
    const rows = compareSplits(cls, 2, 'ok'); // Runner C (mp) is compared even when not OK
    expect(rows.map((r) => r.leg)).toEqual([50, null, null, 40]);
    expect(rows[1].totalDiff).toBeNull();
    expect(rows[2].totalDiff).toBe(16);
  });

  it('reference "all" includes non-OK competitors', () => {
    const okRows = compareSplits(cls, 0, 'ok');
    const allRows = compareSplits(cls, 0, 'all');
    expect(okRows[1].legDiff).toBe(1); // A 45 vs B 44
    expect(allRows[1].legDiff).toBe(1); // D 50 is slower
  });

  it('formats differences', () => {
    expect(formatDiff(0)).toBe('+0:00');
    expect(formatDiff(12.4)).toBe('+0:12');
    expect(formatDiff(3725)).toBe('+1:02:05');
    expect(formatDiff(null)).toBe('–');
  });
});

describe('course sync', () => {
  const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });
  function course(codes: (string | undefined)[]): Course {
    let c = emptyCourse();
    c = appendPoint(c, at(0, 0));
    codes.forEach((code, i) => {
      c = appendPoint(c, at(0, (i + 1) * 100));
      c = { ...c, points: c.points.map((p, k) => (k === c.points.length - 1 ? { ...p, code } : p)) };
    });
    c = appendPoint(c, at(0, (codes.length + 1) * 100));
    return finishAtLast(c);
  }

  it('maps course controls by code, else by position', () => {
    expect(mapCourseToResults(course(['77', '61', '62']), ['77', '61', '62'])).toEqual([-1, 0, 1, 2, 3]);
    expect(mapCourseToResults(course(['77', '99', '62']), ['77', '61', '62'])).toEqual([-1, 0, null, 2, 3]);
    expect(mapCourseToResults(course(['077']), ['77'])).toEqual([-1, 0, 1]);
    expect(mapCourseToResults(course([undefined, undefined, undefined]), ['77', '61', '62'])).toEqual([-1, 0, 1, 2, 3]);
    expect(mapCourseToResults(course([undefined]), ['77', '61'])).toEqual([-1, null, 2]);
  });

  it('local (IOF 2.0) start: zone guessed from the GPX', () => {
    const c = parseResultList(V2).classes[1].competitors[0];
    // Track from 00:00 to 00:20 UTC; local start 02:10 → UTC+2.
    const tr = new Track('T', [pt(0, 0, 0), pt(0, 10, 1200)]);
    const off = guessTzOffset(c, '2026-01-01', tr);
    expect(off).toBe(120);
    expect(runnerStartMs(c, '2026-01-01', off!)).toBe(T0 + 600_000);
  });

  it('punch times and clock offset suggestion', () => {
    const cls = parseResultList(V3).classes[1];
    const runner = cls.competitors[0]; // splits 46, 91, 114, finish 150; start = T0 + 600 s
    const crs = course(['77', '61', '62']);
    const map = mapCourseToResults(crs, cls.controls);
    // GPS clock 3 s behind the punching clock: the runner is at control k at start + split - 3 s.
    const arrive = [0, 46, 91, 114, 150].map((s) => 600 + s - 3);
    const pts = [pt(0, -50, 0)];
    arrive.forEach((t, k) => pts.push(pt(0, k * 100, t)));
    const tr = new Track('T', pts);
    const start = runnerStartMs(runner, null, 0)!;
    expect(punchTimes(map, runner, start, 0)).toEqual([0, 46, 91, 114, 150].map((s) => start + s * 1000));
    const { offset, residuals } = suggestClockOffset(crs, map, runner, start, tr);
    expect(offset).toBeCloseTo(-3, 1);
    residuals.forEach((r) => expect(r!).toBeLessThan(2));
  });
});
