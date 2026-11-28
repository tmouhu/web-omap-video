# EN-12: Coordinate reference systems and view CRS

**Type:** Enabler (architecture) · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `tech`, `geo`, `crs`

## Summary

Everything that is drawn (tiles, raster map, course, track, route choices) is placed in a **view CRS**: a planar
coordinate system in metres. The view CRS is chosen per project:

| Situation                                                                                                       | View CRS                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project located in Finland** (raster map, GPX or course centre inside Finland) – with or without a raster map | **EUREF-FIN / ETRS-TM35FIN (EPSG:3067)**, always                                                                                                            |
| Outside Finland, raster map added                                                                               | **UTM** zone of the map centre (WGS84 UTM, EPSG:326xx / 327xx; ETRS89 UTM EPSG:258xx in Europe); if the raster's own CRS is UTM, that CRS (never resampled) |
| Outside Finland, no raster map                                                                                  | **Web Mercator (EPSG:3857)**, so all common tile services can be used without reprojection                                                                  |
| Nothing loaded yet                                                                                              | TM35FIN (default start view over Finland with MapAnt)                                                                                                       |

Selection UX is in [STORY-15](../stories/STORY-15-view-crs-selection.md).

## Scope / acceptance criteria

- [ ] `Crs` interface: `forward(lonLat) → [x, y]`, `inverse([x, y]) → lonLat`, `pointScale(lonLat)`,
      `gridConvergence(lonLat)`, `code`, `name`, `units = 'm'`.
- [ ] Implementations with `proj4` (bundled definitions): EPSG:4326, 3857, 3067, WGS84 UTM 32601–32660 / 32701–32760,
      ETRS89 UTM 25828–25838.
- [ ] Import-only support for common source CRSs of raster georeferencing, including the Finnish ETRS-GK zones
      (EPSG:3873–3885) and the legacy KKJ/YKJ (EPSG:2393). Rasters in these CRSs are warped into the view CRS.
- [ ] Custom CRS by pasting a proj4 string or WKT (advanced users); no runtime calls to epsg.io.
- [ ] `selectViewCrs({ location, hasRaster, rasterCrs })` implements the table above (location = raster, GPX or course centre, in that order). Finland test = the map centre is inside the
      EPSG:3067 area of use (polygon, not only a bbox); otherwise UTM zone = `floor((lon + 180) / 6) + 1`, with the Norway
      and Svalbard exceptions.
- [ ] Round-trip accuracy ≤ 1 mm in the area of use; unit tests with reference points (e.g. from MML or PROJ).
- [ ] Changing the view CRS re-projects all project geometry; positions stored in the project stay in WGS84 plus the
      raster's own pixel ↔ CRS transform ([EN-15](./EN-15-project-model-and-persistence.md)).
- [ ] North arrow helpers: grid north (view CRS), true north (convergence), magnetic north (declination from the
      World Magnetic Model, or the declination stored with the map).

## Technical notes

- In a TM35/UTM view, "up" at rotation 0 is **grid north**, which differs from true north by the grid convergence
  (a few degrees at the edges of the zone). The north arrow overlay ([STORY-8](../stories/STORY-8-map-overlays.md)) must use
  the correct one.
- Orienteering maps are usually drawn magnetic-north-up. In course mode the map is oriented per leg, so this only affects the
  north arrow and free-mode north-up.

## Decision

- Finnish projects always use TM35FIN (product owner, Nov 2026). This also gives MapAnt's best-quality TM35 service.

## Dependencies

[EN-1](./EN-1-geo-math.md)

## Estimate

TBD
