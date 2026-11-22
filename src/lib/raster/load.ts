/**
 * Loads a raster map from user files (STORY-13): KMZ, KML + image, image + world file (+ .prj),
 * or a plain image (unreferenced → manual georeferencing, STORY-14).
 */
import { UserError } from '../i18n/core';
import type { LatLon } from '../geo/geo';
import { parseGroundOverlay, readKmz } from './kml';
import { crsFromPrj, guessWorldFileCrs, parseWorldFile, WORLD_FILE_EXT, WORLD_FILE_EXTS } from './worldfile';
import type { Affine } from './affine';

export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
const RASTER_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'kmz', 'kml', 'prj', ...WORLD_FILE_EXTS];
export const RASTER_FILE_EXT = new RegExp(`\\.(${RASTER_EXTS.join('|')})$`, 'i');
/** `accept` attribute value for raster file inputs. */
export const RASTER_ACCEPT = RASTER_EXTS.map((e) => `.${e}`).join(',');
/** `accept` for a world file (+ optional .prj) applied to an already loaded image. */
export const WORLD_FILE_ACCEPT = [...WORLD_FILE_EXTS, 'prj'].map((e) => `.${e}`).join(',');

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

/** True if the files are only a world file (+ .prj) – georeferencing for an image that is already loaded. */
export function isWorldFileOnly(files: File[]): boolean {
  return (
    files.some((f) => WORLD_FILE_EXT.test(f.name)) &&
    files.every((f) => WORLD_FILE_EXT.test(f.name) || /\.prj$/i.test(f.name))
  );
}

/**
 * Reads a world file (+ optional .prj) for an image of `width` × `height` px.
 * CRS: from the .prj, else guessed from the coordinates (`crsGuessed`); null if unknown.
 */
export async function readWorldFile(
  files: File[],
  width: number,
  height: number,
  hint: LatLon | null,
): Promise<{ affine: Affine; crs: string | null; crsGuessed: boolean }> {
  const world = files.find((f) => WORLD_FILE_EXT.test(f.name));
  if (!world) throw new UserError('err.worldFile');
  const affine = parseWorldFile(await world.text());
  const prj = files.find((f) => /\.prj$/i.test(f.name));
  const fromPrj = prj ? crsFromPrj(await prj.text()) : null;
  if (fromPrj) return { affine, crs: fromPrj, crsGuessed: false };
  return { affine, crs: guessWorldFileCrs(affine, width, height, hint), crsGuessed: true };
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
  const prj = files.find((f) => /\.prj$/i.test(f.name));
  let size = { width: 0, height: 0 };
  if (!prj || !crsFromPrj(await prj.text())) {
    const bmp = await createImageBitmap(image);
    size = { width: bmp.width, height: bmp.height };
    bmp.close();
  }
  const { affine, crs, crsGuessed } = await readWorldFile(files, size.width, size.height, hint);
  return { name: stem(image.name), image, georef: { kind: 'affine', affine, crs, crsGuessed, source: 'world-file' } };
}
