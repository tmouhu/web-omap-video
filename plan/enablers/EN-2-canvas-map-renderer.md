# EN-2: Map rendering engine (OpenLayers) with rotation and layer stack

**Type:** Enabler (architecture) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `rendering`

## Summary

Draws the stack of layers into one canvas at any rotation and resolution: background tiles, the orienteering raster map,
the course overprint, route choices, the GPX tail, the position arrow and the overlays. The same code renders the on-screen
preview and the video frames. Each frame is a **pure function of the project and the animation time `t`**
([EN-14](./EN-14-animation-timeline-camera.md)), so offline export works ([EN-10](./EN-10-spike-offline-rendering.md)).

## Decision (refinement, Nov 2026): OpenLayers, with a performance gate

The POC uses a custom Canvas 2D renderer. The production app uses **OpenLayers**, because:

- It supports any proj4 CRS (TM35FIN, UTM) with raster reprojection. MapLibre GL only supports Web Mercator.
- WMS, WMTS, GetCapabilities parsing, static georeferenced images and tile caching are built in, which removes a lot of
  custom code in [EN-13](./EN-13-layer-model-and-reprojection.md).
- Rotation, fractional resolution and `pixelRatio` are supported.
- The product owner finds it easier to develop and maintain.

**Performance is not proven yet.** The ADR is accepted only after a prototype passes the gate below. If it fails, the
fallback is a custom WebGL2 tile renderer with the same layer interfaces.

| Concern                                  | Approach to validate                                                                                                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame capture for export                 | Render each export frame with `map.renderSync()` into a separate, export-sized OL map (or OffscreenCanvas), wait for `rendercomplete` (all tiles loaded), then compose the layer canvases into one frame (the standard OL "export map" pattern) |
| Determinism                              | View state (`center`, `resolution`, `rotation`) is set from `frameStateAt(t)` for every frame. No OL animations (`view.animate`) are used for anything that is exported                                                                         |
| Course, tail, arrow, route-choice labels | Drawn on an OL `postrender` / custom canvas layer with our own drawing code, so the IOF symbol details stay under our control                                                                                                                   |
| Large raster map                         | Pre-tiled pyramid ([EN-18](./EN-18-large-raster-handling.md)) served to OL as an XYZ/TileImage source, not one huge `ImageStatic`                                                                                                               |

## Scope / acceptance criteria

- [ ] **Prototype and performance gate**, on a mid-range laptop:
  - MapAnt WMTS in TM35 + a raster map + course + 20 000-point track + tail at 1080p: preview ≥ 50 fps while playing.
  - Export frame render (tiles cached) ≤ 15 ms at 1080p and ≤ 40 ms at 4K.
  - Reprojected Web Mercator layer in a TM35 view: no visible seams or blur at orienteering scales.
- [ ] ADR written (accepted or fallback chosen).
- [ ] Layer stack with z-order, opacity, visibility and blend mode per layer.
- [ ] _(POC)_ While a tile loads, a lower-resolution tile is drawn in its place. OL does this by default.
- [ ] Vector drawing supports the course overprint (gaps at circles), route choices (dashes, halos, fade alpha) and the
      tail (per-segment colour gradient).
- [ ] Text is drawn with a halo and always upright, whatever the map rotation.
- [ ] Track simplification per resolution for very long tracks.
- [ ] Renderer snapshot tests with stubbed tiles ([EN-8](./EN-8-test-strategy.md)).

## POC reference

`src/renderer.ts`. Its overlay drawing (`drawOverlays`, scale bar, north arrow) can be reused in the custom canvas layer.

## Open questions / refinement

- Can OL rendering for export run in a Worker (OffscreenCanvas)? OL has experimental support; check it in the prototype.

## Dependencies

[EN-1](./EN-1-geo-math.md), [EN-3](./EN-3-tile-source-and-cache.md), [EN-12](./EN-12-coordinate-reference-systems.md)

## Estimate

TBD (prototype time-box: 3 days)
