/**
 * OpenLayers layer that draws a georeferenced raster with an arbitrary affine transform
 * (rotation, skew) into an ImageCanvas source, choosing a pyramid level by on-screen pixel size.
 * Works in preview and in the export map (the exporter composes all `.ol-layers canvas`).
 */
import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import { pixelSize } from '../raster/affine';
import { rasterExtent, viewAffine, type RasterMap } from '../raster/rasterMap';

export function createRasterLayer(raster: RasterMap, viewCrs: string): ImageLayer<ImageCanvasSource> {
  const A = viewAffine(raster, viewCrs);
  const source = new ImageCanvasSource({
    projection: viewCrs,
    ratio: 1,
    canvasFunction: (extent, resolution, pixelRatio, size) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(size[0]);
      canvas.height = Math.round(size[1]);
      const ctx = canvas.getContext('2d')!;
      const k = pixelRatio / resolution;
      // Canvas pixels per raster pixel at full resolution → pick the level just above 1:1.
      const onScreen = pixelSize(A) * k;
      const L = Math.min(raster.levels.length - 1, Math.max(0, Math.floor(Math.log2(1 / Math.max(onScreen, 1e-9)))));
      const bmp = raster.levels[L];
      const sx = raster.width / bmp.width;
      const sy = raster.height / bmp.height;
      const [a, b, c, d, e, f] = A;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.setTransform(a * k * sx, -d * k * sx, b * k * sy, -e * k * sy, (c - extent[0]) * k, (extent[3] - f) * k);
      ctx.drawImage(bmp, 0, 0);
      return canvas;
    },
  });
  return new ImageLayer({ source, extent: rasterExtent(raster, viewCrs), className: 'raster-layer' });
}
