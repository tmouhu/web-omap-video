# STORY-16: Default background layers and layer panel

**Type:** Story · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `map`, `ui`

## User story

As a **user**, I want **a good set of background maps ready to use, and control over how they are stacked**,
so that **I can choose the look of the video (topographic, aerial, light background under the orienteering map)**.

## Acceptance criteria

- [ ] **Default background map: MapAnt** ([EN-3](../enablers/EN-3-tile-source-and-cache.md)): the WMTS TM35 service in a TM35
      view, the WMTS EPSG:3857 service in a Web Mercator view. The user does not need to know which one is used.
- [ ] Outside MapAnt coverage (outside Finland, unscanned areas) the fallback layer is shown, with a note in the layer panel.
- [ ] Option to dim MapAnt (its `dim` parameter, 0–100 %) so the course and tail stand out.
- [ ] Layer panel: list in z-order (drag to reorder), visibility toggle, opacity slider, blend mode, thumbnail, attribution,
      "reprojected" badge, error/loading state.
- [ ] Vector layers (course, route choices, GPX tail, arrow) appear in the same panel as fixed top layers with
      visibility toggles.
- [ ] Quick presets: "Orienteering map only", "Orienteering map over MapAnt", "MapAnt only".
- [ ] Layer configuration is stored in the project; the attribution in the video updates automatically.

## Dependencies

[EN-3](../enablers/EN-3-tile-source-and-cache.md), [EN-13](../enablers/EN-13-layer-model-and-reprojection.md)

## Estimate

TBD
