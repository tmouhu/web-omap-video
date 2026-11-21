/**
 * Loads a raster map from user files (STORY-13): KMZ, KML + image, image + world file (+ .prj),
 * or a plain image (unreferenced → manual georeferencing, STORY-14).
 */
import { UserError } from '../i18n/core';
import type { LatLon } from '../geo/geo';
import { parseGroundOverlay, readKmz } from './kml';
import { crsFromPrj, guessWorldFileCrs, parseWorldFile, WORLD_FILE_EXT } from './worldfile';
import type { Affine } from './affine';

export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
export const RASTER_FILE_EXT = /\.(jpe?g|png|gif|webp|bmp|kmz|kml|prj|jgw|jpgw|jpegw|pgw|pngw|tfw|tifw|gfw|gifw|wld)$/i;

export type RasterSourceGeoref =
  | { kind: 'corners'; corners: [number, number][]; source: 'kmz' }
  | { kind: 'affine'; affine: Affine; crs: string | null; crsGuessed: boolean; source: 'world-file' }
  | { kind: 'none' };

export interface RasterSource {
  name: string;
  image: Blob;
  georef: RasterSourceGeoref;
}

const stem = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase();

export function isRasterFile(f: File): boolean {
  return RASTER_FILE_EXT.test(f.name);
}

/** Reads the georeferencing of a set of files. `hint` helps guess world-file CRSs (e.g. GPX centre). */
export async function readRasterFiles(files: File[], hint: LatLon | null): Promise<RasterSource> {
  const kmz = files.find((f) => /\.kmz$/i.test(f.name));
  if (kmz) {
    const { overlay, image } = readKmz(new Uint8Array(await kmz.arrayBuffer()));
    return {
      name: overlay.name || stem(kmz.name),
      image,
      georef: { kind: 'corners', corners: overlay.corners, source: 'kmz' },
    };
  }
  const image = files.find((f) => IMAGE_EXT.test(f.name));
  const kml = files.find((f) => /\.kml$/i.test(f.name));
  if (kml) {
    const overlay = parseGroundOverlay(await kml.text());
    const img = image ?? files.find((f) => f.name === overlay.href.split('/').pop());
    if (!img) throw new UserError('err.kmlNeedsImage', { name: overlay.href });
    return {
      name: overlay.name || stem(img.name),
      image: img,
      georef: { kind: 'corners', corners: overlay.corners, source: 'kmz' },
    };
  }
  if (!image) throw new UserError('err.noMapImage');
  const world = files.find((f) => WORLD_FILE_EXT.test(f.name));
  if (!world) return { name: stem(image.name), image, georef: { kind: 'none' } };
  const affine = parseWorldFile(await world.text());
  const prj = files.find((f) => /\.prj$/i.test(f.name));
  let crs = prj ? crsFromPrj(await prj.text()) : null;
  let crsGuessed = false;
  if (!crs) {
    const bmp = await createImageBitmap(image);
    crs = guessWorldFileCrs(affine, bmp.width, bmp.height, hint);
    bmp.close();
    crsGuessed = true;
  }
  return { name: stem(image.name), image, georef: { kind: 'affine', affine, crs, crsGuessed, source: 'world-file' } };
}
