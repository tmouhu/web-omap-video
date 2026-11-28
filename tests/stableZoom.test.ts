import { describe, expect, it } from 'vitest';
import { STEPS_PER_OCTAVE, stableResolution } from '../src/lib/map/stableZoom';

describe('stable zoom (no tile shimmer during continuous zooms)', () => {
  it('renders at the next coarser quantised resolution; the scale restores the exact view', () => {
    for (const r of [0.37, 1, 1.234, 2.5, 9.99, 123.4]) {
      const s = stableResolution(r);
      expect(s.resolution).toBeGreaterThanOrEqual(r);
      expect(s.scale).toBeGreaterThanOrEqual(1);
      expect(s.scale).toBeLessThan(2 ** (1 / STEPS_PER_OCTAVE) + 1e-9);
      expect(s.resolution / s.scale).toBeCloseTo(r, 12);
      // On the quantisation grid.
      expect(Math.log2(s.resolution) * STEPS_PER_OCTAVE).toBeCloseTo(
        Math.round(Math.log2(s.resolution) * STEPS_PER_OCTAVE),
        9,
      );
    }
  });

  it('a slow continuous zoom changes the rendered resolution only at the steps', () => {
    const rendered = new Set<number>();
    // Zoom in by one octave over 600 frames.
    for (let i = 0; i <= 600; i++) rendered.add(stableResolution(4 * 2 ** (-i / 600)).resolution);
    expect(rendered.size).toBeLessThanOrEqual(STEPS_PER_OCTAVE + 1);
  });

  it('exact grid values are rendered unscaled', () => {
    expect(stableResolution(2)).toEqual({ resolution: 2, scale: 1 });
    expect(stableResolution(0)).toEqual({ resolution: 0, scale: 1 });
  });
});
