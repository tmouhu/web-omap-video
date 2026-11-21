import { describe, expect, it } from 'vitest';
import { forward } from '../src/lib/geo/crs';
import { apply } from '../src/lib/raster/affine';
import { georefFromCorners, placedGeoref, rasterCenter, rasterExtent, viewAffine } from '../src/lib/raster/rasterMap';

const r = {
  width: 4000,
  height: 3000,
  georef: {
    crs: 'EPSG:3067',
    affine: [0.5, 0, 385000, 0, -0.5, 6676000] as [number, number, number, number, number, number],
    source: 'world-file' as const,
  },
};

describe('raster georeference', () => {
  it('same CRS → identical affine; other CRS → fitted with sub-metre error', () => {
    expect(viewAffine(r, 'EPSG:3067')).toBe(r.georef.affine);
    const A = viewAffine(r, 'EPSG:3857');
    const c = rasterCenter(r);
    const exact = forward('EPSG:3857', c);
    const got = apply(A, [2000, 1500]);
    // Web Mercator units are ~2× ground metres at 60°N: 0.2 units ≈ 0.1 m.
    expect(Math.hypot(got[0] - exact[0], got[1] - exact[1])).toBeLessThan(0.2);
  });

  it('extent and centre', () => {
    expect(rasterExtent(r, 'EPSG:3067')).toEqual([385000, 6674500, 387000, 6676000]);
    const c = rasterCenter(r);
    expect(c.lat).toBeGreaterThan(60.1);
    expect(c.lat).toBeLessThan(60.3);
  });

  it('placed georef: north-up, centred, pixel size from print scale and DPI', () => {
    const g = placedGeoref(3000, 2000, [400000, 6700000], 'EPSG:3067', 10000, 300);
    const px = (10000 * 0.0254) / 300;
    expect(g.affine[0]).toBeCloseTo(px, 12);
    expect(apply(g.affine, [1500, 1000])).toEqual([400000, 6700000]);
    expect(g.source).toBe('placed');
  });

  it('georef from lon/lat corners maps the corners back', () => {
    const corners: [number, number][] = [
      [24.9, 60.3],
      [25.1, 60.3],
      [25.1, 60.2],
      [24.9, 60.2],
    ];
    const g = georefFromCorners(corners, 2000, 1000, 'EPSG:3067', 'kmz');
    const tl = forward('EPSG:3067', { lat: 60.3, lon: 24.9 });
    const got = apply(g.affine, [0, 0]);
    // A lon/lat box is not exactly an affine in TM35: a few metres of residual over 11 km is expected.
    expect(Math.hypot(got[0] - tl[0], got[1] - tl[1])).toBeLessThan(25);
  });
});
