// @vitest-environment jsdom
/**
 * Real-world fixtures (tests/resources: an orienteering GPX with HR/cadence and a map image + world file).
 * Validates the track model and world-file handling against real data (EN-4, STORY-13).
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { angleDiff } from '../src/lib/geo/geo';
import { parseGpx } from '../src/lib/gpx/gpx';
import { findOutliers } from '../src/lib/gpx/edits';
import { apply } from '../src/lib/raster/affine';
import { guessWorldFileCrs, parseWorldFile } from '../src/lib/raster/worldfile';
import { Track } from '../src/lib/track/track';

const GPX = 'tests/resources/haukkaroga.gpx';
const JGW = 'tests/resources/h1.jgw';

describe.skipIf(!existsSync(GPX))('real GPX (haukkaroga)', () => {
  const g = parseGpx(readFileSync(GPX, 'utf8'));
  const t = new Track(g.name, g.points);

  it('parses all channels and builds a plausible track', () => {
    expect(t.channels).toEqual({ time: true, elevation: true, heartRate: true, cadence: true });
    expect(t.length / 1000).toBeGreaterThan(5);
    expect(t.length / t.duration).toBeGreaterThan(0.8); // average speed of a run/walk, m/s
    expect(t.length / t.duration).toBeLessThan(6);
  });

  it('smoothed heading is stable (no frame-to-frame spinning)', () => {
    let maxStep = 0;
    for (let s = 1; s < t.duration; s += 1 / 30)
      maxStep = Math.max(maxStep, Math.abs(angleDiff(t.headingAt(s - 1 / 30), t.headingAt(s))));
    expect(maxStep).toBeLessThan(8); // degrees per 1/30 s
  });

  it('few GPS spikes', () => {
    expect(findOutliers(g.points).length).toBeLessThan(g.points.length * 0.01);
  });
});

describe.skipIf(!existsSync(JGW))('real world file (h1.jgw)', () => {
  it('is read and placed in TM35FIN in Finland', () => {
    const a = parseWorldFile(readFileSync(JGW, 'utf8'));
    expect(guessWorldFileCrs(a, 2259, 3235, null)).toBe('EPSG:3067');
    const [x, y] = apply(a, [1130, 1618]);
    expect(x).toBeGreaterThan(50_000);
    expect(y).toBeGreaterThan(6_600_000);
  });
});
