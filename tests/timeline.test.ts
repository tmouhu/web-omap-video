import { describe, expect, it } from 'vitest';
import { forward, pointScale } from '../src/lib/geo/crs';
import { Timeline } from '../src/lib/anim/timeline';
import { groundResolutionForScale } from '../src/lib/geo/geo';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

const track = new Track('L', [pt(0, 0, 0), pt(200, 0, 100), pt(200, 200, 200)]);

describe('Timeline (free mode)', () => {
  it('centres on the position without look-ahead and is deterministic', () => {
    const tl = new Timeline(track, 'EPSG:3067', { scale: 10000, headingUp: false, lookAhead: 0 });
    const f = tl.frameStateAt(50, 600);
    const xy = forward('EPSG:3067', track.positionAt(50));
    expect(f.view.center[0]).toBeCloseTo(xy[0], 6);
    expect(f.view.center[1]).toBeCloseTo(xy[1], 6);
    expect(f.view.rotation).toBeCloseTo(0, 9);
    expect(tl.frameStateAt(50, 600)).toEqual(f);
  });

  it('heading-up rotation uses the grid heading (true heading + convergence)', () => {
    const tl = new Timeline(track, 'EPSG:3067', { scale: 10000, headingUp: true, lookAhead: 0 });
    const f = tl.frameStateAt(40, 600); // running true north at 25°E, west of TM35's 27°E meridian
    expect(f.gridHeading).toBeGreaterThan(1.5);
    expect(f.gridHeading).toBeLessThan(2);
    expect(f.view.rotation).toBeCloseTo(-(f.gridHeading * Math.PI) / 180, 9);
  });

  it('look-ahead puts the runner below the centre along the heading', () => {
    const tl = new Timeline(track, 'EPSG:3067', { scale: 10000, headingUp: true, lookAhead: 0.2 });
    const f = tl.frameStateAt(150, 500); // running east
    const off = 0.2 * 500 * tl.resolution;
    expect(f.view.center[0] - f.positionXY[0]).toBeCloseTo(off, 0);
  });

  it('resolution shows the requested scale (ground metres per CSS px)', () => {
    const tl = new Timeline(track, 'EPSG:3857', { scale: 10000, headingUp: false, lookAhead: 0 });
    expect(tl.resolution / pointScale('EPSG:3857', track.center())).toBeCloseTo(groundResolutionForScale(10000), 9);
    expect(tl.resolution).toBeCloseTo(groundResolutionForScale(10000) * 1.995, 1);
  });
});
