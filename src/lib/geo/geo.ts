/**
 * CRS-independent geo maths (EN-1). Projections live in `crs.ts` (EN-12).
 * Angles are degrees; bearings are 0 = north, clockwise, range [0, 360).
 */
import geodesicPkg from 'geographiclib-geodesic';

export interface LatLon {
  lat: number;
  lon: number;
}

export const EARTH_RADIUS = 6378137;
/** Physical size of one CSS pixel: CSS defines 96 px per inch. */
export const METERS_PER_CSS_PX = 0.0254 / 96;

const WGS84 = geodesicPkg.Geodesic.WGS84;

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance (m) on a sphere. Fast; for internal heuristics. */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ellipsoidal (WGS84) geodesic distance (m). Use for every length shown to the user. */
export function geodesicDistance(a: LatLon, b: LatLon): number {
  return WGS84.Inverse(a.lat, a.lon, b.lat, b.lon, geodesicPkg.Geodesic.DISTANCE).s12 ?? 0;
}

/** Geodesic length (m) of a polyline. */
export function polylineLength(points: LatLon[]): number {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += geodesicDistance(points[i - 1], points[i]);
  return s;
}

/** Initial great-circle bearing from a to b. */
export function bearing(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dλ = toRad(b.lon - a.lon);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return normalizeAngle(toDeg(Math.atan2(y, x)));
}

/** Bearing of the vector (dx east, dy north) in a planar CRS (grid bearing). */
export function gridBearing(dx: number, dy: number): number {
  return normalizeAngle(toDeg(Math.atan2(dx, dy)));
}

/** Shortest signed angular difference b - a, range (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Ground metres per CSS pixel for a map scale 1:scale. */
export function groundResolutionForScale(scale: number): number {
  return scale * METERS_PER_CSS_PX;
}

/** Map scale denominator for a ground resolution (m per CSS px). */
export function scaleForGroundResolution(res: number): number {
  return res / METERS_PER_CSS_PX;
}

const WGS84_A = 6378137;
const WGS84_E2 = 0.00669437999014;

/**
 * Ellipsoidal distance for short segments (< ~1 km), using the meridian (M) and prime vertical (N)
 * radii at the mid-latitude. Error < 0.01 % for GPS-sized steps; ~50× faster than a full geodesic.
 */
export function segmentDistance(a: LatLon, b: LatLon): number {
  const φ = toRad((a.lat + b.lat) / 2);
  const s = Math.sin(φ);
  const w = 1 - WGS84_E2 * s * s;
  const N = WGS84_A / Math.sqrt(w);
  const M = (WGS84_A * (1 - WGS84_E2)) / (w * Math.sqrt(w));
  const dy = toRad(b.lat - a.lat) * M;
  const dx = toRad(b.lon - a.lon) * N * Math.cos(φ);
  return Math.hypot(dx, dy);
}
