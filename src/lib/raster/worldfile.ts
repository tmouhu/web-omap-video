/** World files (.jgw/.pgw/.tfw/.wld …) and .prj CRS detection (STORY-13). */
import { UserError } from '../i18n/core';
import { isInFinland } from '../geo/finland';
import { utmCrs } from '../geo/crs';
import type { LatLon } from '../geo/geo';
import { apply, type Affine } from './affine';

export const WORLD_FILE_EXTS = [
  'jgw',
  'jpgw',
  'jpegw',
  'pgw',
  'pngw',
  'tfw',
  'tifw',
  'tiffw',
  'gfw',
  'gifw',
  'wld',
  'bpw',
  'wfw',
];
export const WORLD_FILE_EXT = new RegExp(`\\.(${WORLD_FILE_EXTS.join('|')})$`, 'i');

/**
 * Parses the six world-file lines A, D, B, E, C, F (C, F = centre of the top-left pixel)
 * into a corner-convention affine.
 */
export function parseWorldFile(text: string): Affine {
  const v = text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (v.length < 6 || v.slice(0, 6).some((x) => !Number.isFinite(x))) {
    throw new UserError('err.worldFile');
  }
  const [A, D, B, E, C, F] = v;
  return [A, B, C - 0.5 * A - 0.5 * B, D, E, F - 0.5 * D - 0.5 * E];
}

/** Serialises a corner-convention affine back to world-file text. */
export function formatWorldFile(a: Affine): string {
  const [A, B, c, D, E, f] = a;
  return [A, D, B, E, c + 0.5 * A + 0.5 * B, f + 0.5 * D + 0.5 * E].map((x) => x.toFixed(10)).join('\n') + '\n';
}

/** CRS code from a .prj (ESRI WKT) file, for the CRSs we support; null if unknown. */
export function crsFromPrj(wkt: string): string | null {
  const s = wkt.toUpperCase();
  const epsg = s.match(/AUTHORITY\["EPSG",\s*"?(\d+)"?\]\s*\]\s*$/) ?? s.match(/ID\["EPSG",\s*(\d+)\]\s*\]\s*$/);
  if (epsg) return `EPSG:${epsg[1]}`;
  if (/TM35FIN|TM35_FIN|ETRS[-_ ]?TM35/.test(s)) return 'EPSG:3067';
  const utm = s.match(/UTM[_ ]ZONE[_ ](\d{1,2})\s*([NS])?/);
  if (utm) {
    const zone = +utm[1];
    const south = utm[2] === 'S';
    const lon = zone * 6 - 183;
    return utmCrs({ lat: south ? -10 : 10, lon }).code;
  }
  if (/PSEUDO[-_ ]?MERCATOR|WEB[_ ]MERCATOR|3857/.test(s)) return 'EPSG:3857';
  if (/^GEOGCS/.test(s.trim()) && /WGS[_ ]?(19)?84/.test(s)) return 'EPSG:4326';
  return null;
}

/**
 * Best guess of the CRS of world-file coordinates when there is no .prj.
 * `hint` = a known location (e.g. GPX centre) used to pick a UTM zone outside Finland.
 */
export function guessWorldFileCrs(a: Affine, width: number, height: number, hint: LatLon | null): string | null {
  const [x, y] = apply(a, [width / 2, height / 2]);
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90 && Math.abs(a[0]) < 0.01) return 'EPSG:4326';
  if (x > 2.0e6 && x < 3.6e6 && y > 8.0e6 && y < 11.5e6) return 'EPSG:3857'; // Finland in Web Mercator
  const tmLike = x > 0 && x < 1e6 && y > 0 && y < 9.4e6;
  if (tmLike) {
    if (!hint || isInFinland(hint.lon, hint.lat)) return y > 6.5e6 && y < 7.85e6 ? 'EPSG:3067' : null;
    return utmCrs(hint).code;
  }
  return null;
}
