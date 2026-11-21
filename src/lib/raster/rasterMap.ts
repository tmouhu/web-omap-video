/**
 * Raster orienteering map (STORY-13, EN-18). Holds a decoded image pyramid and its georeference
 * (pixel → `crs` affine). Large images: levels are ImageBitmaps halved until ≤ 512 px.
 * (Full tiling into IndexedDB per EN-18 is a later step.)
 */
import { forward, inverse } from '../geo/crs';
import type { LatLon } from '../geo/geo';
import { apply, fitTransform, invert, type Affine, type Pt } from './affine';

export type GeorefSource = 'world-file' | 'kmz' | 'manual' | 'placed';

export interface RasterGeoref {
  /** CRS of the affine's output coordinates. */
  crs: string;
  affine: Affine;
  source: GeorefSource;
}

export interface RasterMap {
  name: string;
  width: number;
  height: number;
  /** levels[0] = full resolution; levels[i] = 1/2^i. */
  levels: ImageBitmap[];
  georef: RasterGeoref;
  /** Print scale denominator of the map (e.g. 10000), if known. */
  printScale: number | null;
}

/** Decodes an image and builds a downsampled pyramid. */
export async function buildPyramid(blob: Blob): Promise<ImageBitmap[]> {
  const full = await createImageBitmap(blob);
  const levels = [full];
  let w = full.width;
  let h = full.height;
  while (Math.max(w, h) > 512) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
    levels.push(
      await createImageBitmap(levels[levels.length - 1], { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }),
    );
  }
  return levels;
}

export function releaseRaster(r: RasterMap | null): void {
  r?.levels.forEach((b) => b.close());
}

/** Image corners + centre in pixel coordinates. */
function samplePixels(r: { width: number; height: number }): Pt[] {
  const { width: w, height: h } = r;
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
    [w / 2, h / 2],
  ];
}

/** Pixel → view-CRS affine. Exact when the CRSs match; otherwise fitted through corners + centre. */
export function viewAffine(r: Pick<RasterMap, 'width' | 'height' | 'georef'>, viewCrs: string): Affine {
  const { crs, affine } = r.georef;
  if (crs === viewCrs) return affine;
  const px = samplePixels(r);
  const world = px.map((p) => forward(viewCrs, inverse(crs, apply(affine, p))));
  return fitTransform(px, world, affine).affine;
}

/** Geographic centre of the raster. */
export function rasterCenter(r: Pick<RasterMap, 'width' | 'height' | 'georef'>): LatLon {
  return inverse(r.georef.crs, apply(r.georef.affine, [r.width / 2, r.height / 2]));
}

/** View-CRS extent [minX, minY, maxX, maxY] of the raster. */
export function rasterExtent(r: Pick<RasterMap, 'width' | 'height' | 'georef'>, viewCrs: string): number[] {
  const A = viewAffine(r, viewCrs);
  const pts = samplePixels(r)
    .slice(0, 4)
    .map((p) => apply(A, p));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Georeference from four lon/lat corners (TL, TR, BR, BL), expressed in `crs`. */
export function georefFromCorners(
  corners: [number, number][],
  width: number,
  height: number,
  crs: string,
  source: GeorefSource,
): RasterGeoref {
  const px: Pt[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const world = corners.map(([lon, lat]) => forward(crs, { lat, lon }));
  return { crs, affine: fitTransform(px, world, [1, 0, 0, 0, -1, 0]).affine, source };
}

/**
 * Initial placement of an unreferenced image: north-up, centred on `center` (view CRS),
 * pixel size from print scale and scan DPI.
 */
export function placedGeoref(
  width: number,
  height: number,
  center: Pt,
  crs: string,
  printScale = 10000,
  dpi = 300,
): RasterGeoref {
  const px = (printScale * 0.0254) / dpi;
  return {
    crs,
    affine: [px, 0, center[0] - (width / 2) * px, 0, -px, center[1] + (height / 2) * px],
    source: 'placed',
  };
}

/** Map coordinate (view CRS) → raster pixel. */
export function viewToPixel(r: Pick<RasterMap, 'width' | 'height' | 'georef'>, viewCrs: string, xy: Pt): Pt {
  return apply(invert(viewAffine(r, viewCrs)), xy);
}
