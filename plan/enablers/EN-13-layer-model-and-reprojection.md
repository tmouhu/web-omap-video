# EN-13: Layer model, WMS/WMTS and reprojection (on OpenLayers)

**Type:** Enabler (architecture) · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `tech`, `map`, `rendering`

## Summary
A layer model on top of OpenLayers ([EN-2](./EN-2-canvas-map-renderer.md)), so that MapAnt, other WMTS/WMS/XYZ services
and the local raster map can be shown in any view CRS ([EN-12](./EN-12-coordinate-reference-systems.md)), stacked and
blended, and stored in the project.

## Scope / acceptance criteria
- [ ] Layer types mapped to OL sources:
  - **WMTS** → `ol/source/WMTS` with options from `ol/format/WMTSCapabilities` (e.g. MapAnt `ETRS-TM35FIN` and `EPSG3857`)
  - **WMS** → `ol/source/TileWMS` (tiled, cacheable). Tile size is kept moderate for MapAnt WMS (≤ 1024 px).
  - **XYZ** → `ol/source/XYZ`
  - **Georeferenced raster** → tiled pyramid source ([EN-18](./EN-18-large-raster-handling.md))
  - **Vector overlays** (course, route choices, track): our own canvas layer
- [ ] Our own layer descriptor (serialisable into the project): id, type, URL, layer, matrix set, format, opacity,
      visibility, z-order, blend mode, attribution. Descriptor ↔ OL layer factory.
- [ ] Source selection by view CRS: if a service offers the view CRS (e.g. MapAnt TM35 in a TM35 view), that matrix set is
      used natively. Otherwise OL raster reprojection is used, and the layer panel shows a "reprojected" badge.
- [ ] Capabilities parsing for WMTS and WMS, used by [STORY-17](../stories/STORY-17-custom-wms-wmts.md).
- [ ] CORS check: layers whose tiles cannot be loaded with `crossOrigin: 'anonymous'` are rejected with a clear message,
      because they would break export. Out-of-coverage redirects (MapAnt `notavailable`) are treated as empty tiles.
- [ ] Cache-API-backed `tileLoadFunction` with throttling per host ([EN-3](./EN-3-tile-source-and-cache.md)).
- [ ] Tests: tile URLs for a rotated view in TM35 and in 3857; reprojection quality check (no visible seams at 1:5 000–1:20 000).

## Dependencies
[EN-2](./EN-2-canvas-map-renderer.md), [EN-3](./EN-3-tile-source-and-cache.md), [EN-12](./EN-12-coordinate-reference-systems.md)

## Estimate
TBD
