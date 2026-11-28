# STORY-13: Add an orienteering raster map

**Type:** Story · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `map`, `orienteering`, `georef`

## User story

As an **orienteer**, I want to **add the orienteering map of my event as an image**,
so that **the video shows the real map instead of a generic background map**.

## Acceptance criteria

- [ ] Add map via file picker or drop: JPG, PNG, WebP, TIFF/GeoTIFF, KMZ, PDF (if [EN-18](../enablers/EN-18-large-raster-handling.md) includes it).
- [ ] Georeference is read automatically when present:
  - **World file** (`.jgw`, `.pgw`, `.tfw`, `.wld`) dropped together with the image. The CRS is asked for (world files do not
    store it), with a smart default: TM35FIN if the coordinates fit Finland, otherwise the matching UTM zone.
  - **GeoTIFF** tags (CRS + transform).
  - **KMZ / KML GroundOverlay** (`LatLonBox` with rotation, or `gx:LatLonQuad`), as exported by OCAD, OOM and Livelox.
  - **OCAD / OOM raster export** world files with the CRS in the file name or the accompanying `.prj`.
- [ ] Without a georeference, the user goes to manual georeferencing ([STORY-14](./STORY-14-georeference-raster-manually.md)).
- [ ] After georeferencing, the map is placed in the view CRS chosen by [STORY-15](./STORY-15-view-crs-selection.md)
      (TM35FIN in Finland, UTM elsewhere) and the view fits the map.
- [ ] Map properties: name, **print scale** (1:N, used for course symbol sizes), opacity, blend mode (normal / multiply),
      optional magnetic declination.
- [ ] Large images are processed into a tiled pyramid with progress ([EN-18](../enablers/EN-18-large-raster-handling.md)).
- [ ] Alignment check: the GPX is drawn on top. An "alignment" slider fades between the raster and the background map,
      so misalignment is easy to see.
- [ ] Replace or remove the map. One raster map per project in this story (multiple maps, e.g. sprint relay, is a follow-up).
- [ ] The file stays on the device (same privacy statement as GPX).

## Technical notes

- A KMZ `LatLonBox` + rotation is an affine in WGS84 degrees. It is converted to an affine in the view CRS. The residual is
  negligible at orienteering map sizes.

## Open questions / refinement

- Support multiple raster maps (e.g. different map sheets, relay courses)?
- Crop the map margin (legend, course description sheet) so it does not cover the background map?

## Dependencies

[EN-12](../enablers/EN-12-coordinate-reference-systems.md), [EN-13](../enablers/EN-13-layer-model-and-reprojection.md), [EN-18](../enablers/EN-18-large-raster-handling.md)

## Estimate

TBD
