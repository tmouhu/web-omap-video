import { describe, expect, it } from 'vitest';
import { apply, fitTransform, invert, pixelSize, rotationDeg, type Affine, type Pt } from '../src/lib/raster/affine';

// 0.5 m pixels, rotated 10°, origin at (400000, 6700000)
const t = (10 * Math.PI) / 180;
const s = 0.5;
const TRUE: Affine = [s * Math.cos(t), s * Math.sin(t), 400000, s * Math.sin(t), -s * Math.cos(t), 6700000];
const px: Pt[] = [
  [100, 200],
  [3000, 250],
  [1500, 2800],
  [2900, 2600],
  [50, 2900],
];
const world = px.map((p) => apply(TRUE, p));

describe('affine', () => {
  it('inverts', () => {
    const p: Pt = [1234.5, 987.25];
    const q = apply(invert(TRUE), apply(TRUE, p));
    expect(q[0]).toBeCloseTo(p[0], 6);
    expect(q[1]).toBeCloseTo(p[1], 6);
  });

  it('pixel size and rotation', () => {
    expect(pixelSize(TRUE)).toBeCloseTo(0.5, 9);
    expect(rotationDeg([1, 0, 0, 0, -1, 0])).toBeCloseTo(0, 9);
  });

  it('1 pair shifts the current transform', () => {
    const cur: Affine = [0.5, 0, 0, 0, -0.5, 0];
    const r = fitTransform([px[0]], [world[0]], cur);
    expect(r.kind).toBe('shift');
    const q = apply(r.affine, px[0]);
    expect(q[0]).toBeCloseTo(world[0][0], 6);
    expect(r.affine[0]).toBe(0.5);
  });

  it('2 pairs recover a similarity (rotation + scale, mirrored rows) exactly', () => {
    const r = fitTransform(px.slice(0, 2), world.slice(0, 2), [1, 0, 0, 0, -1, 0]);
    expect(r.kind).toBe('similarity');
    r.affine.forEach((v, i) => expect(v).toBeCloseTo(TRUE[i], 6));
  });

  it('3+ pairs fit an affine with residuals; noise shows in the RMS', () => {
    const exact = fitTransform(px, world, [1, 0, 0, 0, -1, 0]);
    expect(exact.kind).toBe('affine');
    expect(exact.rms).toBeLessThan(1e-6);
    const noisy = world.map((w, i) => [w[0] + (i % 2 ? 2 : -2), w[1]] as Pt);
    const r = fitTransform(px, noisy, [1, 0, 0, 0, -1, 0]);
    expect(r.rms).toBeGreaterThan(0.5);
    expect(r.residuals).toHaveLength(5);
    const sim = fitTransform(px, world, [1, 0, 0, 0, -1, 0], 'similarity');
    expect(sim.kind).toBe('similarity');
    expect(sim.rms).toBeLessThan(1e-6);
  });

  it('rejects degenerate points', () => {
    expect(() =>
      fitTransform(
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        [1, 0, 0, 0, -1, 0],
      ),
    ).toThrow(/degenerate/);
  });
});
