# EN-18: Large raster image handling (tiled pyramid)

**Type:** Enabler (architecture) · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `tech`, `map`, `performance`

## Summary
Orienteering map images are large. An A3 map at 600 dpi is about 7 000 × 10 000 px (70 MP, ≈ 280 MB decoded).
Browsers limit canvas size (Safari especially) and memory. The raster must be cut into a tiled image pyramid once, in a
Worker, and then rendered like any tile layer.

## Scope / acceptance criteria
- [ ] Accept JPG, PNG, WebP, TIFF/GeoTIFF (via a WASM/JS decoder such as `geotiff.js`) up to at least 100 MP.
- [ ] In a Worker: decode once → build 512 px tiles for the full-resolution level and downsampled levels (÷2 until one tile)
      with good resampling (area/Lanczos), so small-scale views do not alias.
- [ ] Tiles stored in IndexedDB/OPFS with the project ([EN-15](./EN-15-project-model-and-persistence.md)); a project reopens
      without decoding the source again.
- [ ] Progress UI and cancel; memory stays below an agreed ceiling (e.g. 1 GB) during processing.
- [ ] The raster is rendered as a tile layer through [EN-13](./EN-13-layer-model-and-reprojection.md) with an affine
      (or, after warping, a polynomial) pixel → view CRS transform.
- [ ] Performance: a 70 MP map is processed in < 15 s on a mid-range laptop; panning stays at 60 fps.

## Open questions / refinement
- PDF maps (common from event organisers): rasterise with pdf.js at a chosen DPI, then the same pipeline?
- Keep the original file in the project (for re-processing) or only the pyramid?

## Dependencies
[EN-2](./EN-2-canvas-map-renderer.md)

## Estimate
TBD
