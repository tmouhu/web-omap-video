# EN-11: Spike – orienteering vector maps (OMAP/XMAP/OCD) as a map layer

**Type:** Enabler (spike) · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Could · **Labels:** `spike`, `map`, `orienteering`

## Problem

Orienteers want to replay their run on the **actual orienteering map**. **Georeferenced raster maps** are now covered by
stories [STORY-13](../stories/STORY-13-add-raster-map.md) and [STORY-14](../stories/STORY-14-georeference-raster-manually.md),
and projections by [EN-12](./EN-12-coordinate-reference-systems.md). This spike only checks whether **vector source files**
(OpenOrienteering Mapper `.omap` / `.xmap`, OCAD `.ocd`) can be loaded directly, without a raster export step.

## Spike goals (time-boxed)

- [ ] Assess parsing `.omap`/`.xmap` (XML, documented) and rendering ISOM symbols with the renderer: effort, symbol coverage,
      and render quality compared with a raster export.
- [ ] Assess OCAD `.ocd` (binary, versioned format; existing open-source readers?).
- [ ] Use the georeferencing embedded in these files (CRS + grid/declination) to place the map automatically.
- [ ] Alternative with less effort: rasterise the vector file in a Worker at the needed resolution and feed it into the raster
      pipeline ([EN-18](./EN-18-large-raster-handling.md)).
- [ ] Recommendation and rough sizing.

## Output

Decision record, prototype, follow-up stories (if worthwhile).

## Dependencies

[EN-2](./EN-2-canvas-map-renderer.md), [EN-12](./EN-12-coordinate-reference-systems.md), [EN-18](./EN-18-large-raster-handling.md)

## Estimate

Time-box: TBD
