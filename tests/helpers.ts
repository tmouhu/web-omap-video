import type { GpxPoint } from '../src/lib/gpx/gpx';

export const M_LAT = 111320;
export const T0 = Date.parse('2026-01-01T00:00:00Z');

/** GPX point `north`/`east` metres from (60 N, 25 E) at `sec` seconds (null = no time). */
export const pt = (north: number, east: number, sec: number | null, extra: Partial<GpxPoint> = {}): GpxPoint => ({
  lat: 60 + north / M_LAT,
  lon: 25 + east / (M_LAT * Math.cos((60 * Math.PI) / 180)),
  time: sec === null ? null : T0 + sec * 1000,
  ele: null,
  hr: null,
  cad: null,
  ...extra,
});
