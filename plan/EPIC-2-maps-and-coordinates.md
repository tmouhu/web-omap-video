# EPIC-2: Orienteering maps, background layers and coordinate systems

**Type:** Epic · **Status:** In progress (Nov 2026) · **Labels:** `map`, `crs`, `georef`

## Summary

Let users show their run on the **real orienteering map**, on top of good background maps, in the right coordinate
system: **EUREF-FIN TM35** in Finland and **UTM** elsewhere when a raster map is used, and **Web Mercator** when there is no
raster map, so the widest range of map services is available.

## Business goal / motivation

- An orienteering video only makes sense on the orienteering map.
- Orienteering maps are drawn in national grids. Showing them in their own grid avoids resampling blur and keeps
  "up" consistent with the printed map.
- Background maps (topographic, aerial) add context and fill the area around the orienteering map.

## Scope (in)

- Raster map upload with automatic georeference (world file, GeoTIFF, KMZ) and manual control-point georeferencing.
- View CRS selection (TM35FIN / UTM / Web Mercator) and on-the-fly reprojection of layers.
- Default background map **MapAnt** (WMTS, TM35 and Web Mercator), a fallback layer, and a layer panel.
- Custom WMS / WMTS layers.
- Large raster handling.

## Scope (out, for now)

- Direct rendering of OMAP/OCD vector files (spike [EN-11](./enablers/EN-11-spike-orienteering-maps.md)).
- Several raster maps in one project.
- DEM / hillshade layers.

## Child issues

- Stories: [STORY-13](./stories/STORY-13-add-raster-map.md), [STORY-14](./stories/STORY-14-georeference-raster-manually.md),
  [STORY-15](./stories/STORY-15-view-crs-selection.md), [STORY-16](./stories/STORY-16-background-layers.md),
  [STORY-17](./stories/STORY-17-custom-wms-wmts.md)
- Enablers: [EN-3](./enablers/EN-3-tile-source-and-cache.md), [EN-11](./enablers/EN-11-spike-orienteering-maps.md),
  [EN-12](./enablers/EN-12-coordinate-reference-systems.md), [EN-13](./enablers/EN-13-layer-model-and-reprojection.md),
  [EN-18](./enablers/EN-18-large-raster-handling.md)

## Definition of done (epic level)

- A KMZ-georeferenced Finnish orienteering map is shown in TM35FIN over MapAnt, with GPX alignment within GPS accuracy.
- A world-file map from another country is shown in its UTM zone over global layers.
- Without a raster map, Web Mercator is used and any XYZ service works.
- An unreferenced scanned map can be georeferenced with 3+ points to RMS < 5 m.

## Risks

| Risk                                                             | Mitigation                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Reprojection quality/performance in Canvas 2D                    | OpenLayers performance gate in EN-2; MapAnt serves both TM35 and 3857, so the default needs no client reprojection |
| MapAnt is a free single-server service (no SLA, DDoS protection) | Throttled loading, persistent cache, fallback layer (EN-3)                                                         |
| Tile services without CORS cannot be exported                    | Detect early and explain (STORY-17), curated defaults                                                              |
| Very large map images exhaust memory (Safari)                    | EN-18 Worker pyramid, memory ceiling                                                                               |
| Users do not know which CRS their world file is in               | Smart defaults + alignment check view (STORY-13)                                                                   |

## Estimate

TBD
