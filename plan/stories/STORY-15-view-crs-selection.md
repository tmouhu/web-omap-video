# STORY-15: Automatic map coordinate system selection

**Type:** Story · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `map`, `crs`

## User story
As a **user**, I want **the app to pick the right map coordinate system automatically**,
so that **the orienteering map is shown sharp and undistorted in Finland and elsewhere, without me needing to know
GIS**. An advanced user can override the choice.

## Acceptance criteria
- [ ] Rules from [EN-12](../enablers/EN-12-coordinate-reference-systems.md):
  - **Project in Finland → always EUREF-FIN TM35 (EPSG:3067)**, with or without a raster map.
  - Outside Finland with a raster map → **UTM** zone of the map centre (or the raster's own UTM CRS, not resampled).
  - **Outside Finland without a raster map → Web Mercator (EPSG:3857)**, so the widest range of background map services works.
- [ ] The CRS is chosen when the first location (raster, GPX or course) is known, and switches automatically when it changes country or a raster map is added or removed outside Finland. The view (centre, scale, rotation) is kept as
      closely as possible.
- [ ] The current CRS is shown in the status bar (e.g. "ETRS-TM35FIN") with a tooltip explaining why it was chosen.
- [ ] Advanced setting: choose another CRS from a list (TM35FIN, UTM zones, Web Mercator), or a custom proj4/WKT.
- [ ] Background layers that do not offer the view CRS are reprojected on the fly
      ([EN-13](../enablers/EN-13-layer-model-and-reprojection.md)). The layer panel marks them ("reprojected").
- [ ] Course, GPX, route choices and edits keep their positions exactly across CRS changes (they are stored in WGS84).

## Dependencies
[EN-12](../enablers/EN-12-coordinate-reference-systems.md), [EN-13](../enablers/EN-13-layer-model-and-reprojection.md)

## Estimate
TBD
