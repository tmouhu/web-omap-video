import { describe, expect, it } from 'vitest';
import {
  forward,
  gridConvergence,
  inverse,
  pointScale,
  selectViewCrs,
  TM35FIN,
  utmZone,
  WEB_MERCATOR,
} from '../src/lib/geo/crs';
import { isInFinland } from '../src/lib/geo/finland';

describe('Finland test', () => {
  it.each([
    ['Helsinki', 24.94, 60.17],
    ['Oulu', 25.47, 65.01],
    ['Rovaniemi', 25.7, 66.5],
    ['Inari', 27.0, 68.9],
    ['Mariehamn', 19.94, 60.1],
    ['Joensuu', 29.76, 62.6],
  ])('%s is in Finland', (_n, lon, lat) => expect(isInFinland(lon, lat)).toBe(true));
  it.each([
    ['Tallinn', 24.75, 59.44],
    ['Stockholm', 18.07, 59.33],
    ['Luleå', 22.15, 65.58],
    ['St Petersburg', 30.3, 59.94],
    ['Murmansk', 33.1, 68.97],
    ['Tromsø', 18.9, 69.6],
    ['Oslo', 10.75, 59.91],
  ])('%s is not in Finland', (_n, lon, lat) => expect(isInFinland(lon, lat)).toBe(false));
});

describe('view CRS selection', () => {
  const hki = { lat: 60.17, lon: 24.94 };
  const oslo = { lat: 59.91, lon: 10.75 };
  it('TM35FIN when nothing is loaded and always in Finland', () => {
    expect(selectViewCrs({ location: null, hasRaster: false })).toBe(TM35FIN);
    expect(selectViewCrs({ location: hki, hasRaster: false })).toBe(TM35FIN);
    expect(selectViewCrs({ location: hki, hasRaster: true })).toBe(TM35FIN);
  });
  it('outside Finland: UTM with raster, Web Mercator without', () => {
    expect(selectViewCrs({ location: oslo, hasRaster: false })).toBe(WEB_MERCATOR);
    expect(selectViewCrs({ location: oslo, hasRaster: true }).code).toBe('EPSG:32632');
    expect(selectViewCrs({ location: { lat: -33.9, lon: 151.2 }, hasRaster: true }).code).toBe('EPSG:32756');
    expect(utmZone(-180)).toBe(1);
    expect(utmZone(179.9)).toBe(60);
  });
});

describe('projections', () => {
  it('TM35FIN reference point (central meridian 27°E at equator-false-easting 500 000)', () => {
    const [x, y] = forward('EPSG:3067', { lat: 60, lon: 27 });
    expect(x).toBeCloseTo(500000, 3);
    expect(y).toBeGreaterThan(6650000);
    expect(y).toBeLessThan(6660000);
  });
  it('round-trips within 1 mm', () => {
    const p = { lat: 60.2035, lon: 24.9105 };
    const back = inverse('EPSG:3067', forward('EPSG:3067', p));
    expect(Math.abs(back.lat - p.lat) * 111000).toBeLessThan(0.001);
    expect(Math.abs(back.lon - p.lon) * 55000).toBeLessThan(0.001);
  });
  it('grid bearing of true north: 0 on the central meridian, ≈ Δλ·sin φ west of it', () => {
    expect(gridConvergence('EPSG:3067', { lat: 62, lon: 27 })).toBeCloseTo(0, 4);
    const c = gridConvergence('EPSG:3067', { lat: 60.17, lon: 24.94 });
    expect(c).toBeCloseTo((27 - 24.94) * Math.sin((60.17 * Math.PI) / 180), 1);
  });
  it('point scale ≈ 0.9996 on the TM35 central meridian and a/(N cos φ) in Web Mercator', () => {
    expect(pointScale('EPSG:3067', { lat: 62, lon: 27 })).toBeCloseTo(0.9996, 4);
    const s = Math.sin(Math.PI / 3);
    const nOverA = 1 / Math.sqrt(1 - 0.00669437999014 * s * s);
    expect(pointScale('EPSG:3857', { lat: 60, lon: 25 })).toBeCloseTo(1 / (nOverA * Math.cos(Math.PI / 3)), 4);
  });
});
