/**
 * Coordinate reference systems and view CRS selection (EN-12).
 * The view CRS is planar (metres); everything is drawn in it. Stored geometry stays WGS84.
 */
import proj4 from 'proj4';
import { isInFinland } from './finland';
import { geodesicDistance, type LatLon } from './geo';

export interface CrsInfo {
  code: string;
  name: string;
}

export const TM35FIN: CrsInfo = { code: 'EPSG:3067', name: 'ETRS-TM35FIN' };
export const WEB_MERCATOR: CrsInfo = { code: 'EPSG:3857', name: 'Web Mercator' };

proj4.defs('EPSG:3067', '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

export function utmZone(lon: number): number {
  return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
}

/** WGS84 UTM CRS for a location (registers the proj4 definition on demand). */
const utmCache = new Map<string, CrsInfo>();

/** WGS84 UTM CRS for a location (registers the proj4 definition on demand; same object per zone). */
export function utmCrs(p: LatLon): CrsInfo {
  const zone = utmZone(p.lon);
  const south = p.lat < 0;
  const code = `EPSG:${south ? 327 : 326}${String(zone).padStart(2, '0')}`;
  let info = utmCache.get(code);
  if (!info) {
    proj4.defs(code, `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs +type=crs`);
    utmCache.set(code, (info = { code, name: `UTM zone ${zone}${south ? 'S' : 'N'}` }));
  }
  return info;
}

/** True when proj4 knows the CRS code (built-in, TM35FIN or a registered UTM zone). */
export function isKnownCrs(code: string): boolean {
  if (/^EPSG:32[67]\d\d$/.test(code)) {
    const zone = +code.slice(-2);
    utmCrs({ lat: code.startsWith('EPSG:327') ? -10 : 10, lon: zone * 6 - 183 });
  }
  return !!proj4.defs(code);
}

export function crsName(code: string): string {
  if (code === TM35FIN.code) return TM35FIN.name;
  if (code === WEB_MERCATOR.code) return WEB_MERCATOR.name;
  if (code === 'EPSG:4326') return 'WGS84 (lon/lat)';
  return utmCache.get(code)?.name ?? code;
}

export interface CrsSelectionInput {
  /** Centre of the raster map, else of the GPX, else of the course. Null when nothing is loaded. */
  location: LatLon | null;
  hasRaster: boolean;
}

/**
 * View CRS rules (product decision, Nov 2026):
 * - nothing loaded → TM35FIN; project in Finland → always TM35FIN;
 * - outside Finland with a raster map → UTM zone; outside Finland without raster → Web Mercator.
 */
export function selectViewCrs({ location, hasRaster }: CrsSelectionInput): CrsInfo {
  if (!location || isInFinland(location.lon, location.lat)) return TM35FIN;
  return hasRaster ? utmCrs(location) : WEB_MERCATOR;
}

export function forward(code: string, p: LatLon): [number, number] {
  return proj4('EPSG:4326', code, [p.lon, p.lat]) as [number, number];
}

export function inverse(code: string, xy: [number, number]): LatLon {
  const [lon, lat] = proj4(code, 'EPSG:4326', xy);
  return { lat, lon };
}

/**
 * Grid bearing of true north at p (degrees). Grid bearing = true bearing + this value.
 * In TM/UTM (northern hemisphere) it is positive west of the central meridian.
 * Computed numerically so it works for any registered CRS.
 */
export function gridConvergence(code: string, p: LatLon): number {
  const a = forward(code, p);
  const b = forward(code, { lat: p.lat + 1e-4, lon: p.lon });
  return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
}

/** Point scale factor: projected metres per ground metre at p (east-west direction). */
export function pointScale(code: string, p: LatLon): number {
  const d = 1e-4;
  const w = { lat: p.lat, lon: p.lon - d };
  const e = { lat: p.lat, lon: p.lon + d };
  const a = forward(code, w);
  const b = forward(code, e);
  const ground = geodesicDistance(w, e);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / ground;
}

export { proj4 };
