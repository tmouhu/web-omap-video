# STORY-17: Add a custom WMS or WMTS layer

**Type:** Story · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Should · **Labels:** `map`, `wms`, `wmts`

## User story
As an **advanced user**, I want to **add a map service by its WMS or WMTS address**, so that **I can use e.g. a municipal
map, old aerial photos or a national map of another country as the background**.

## Acceptance criteria
- [ ] "Add layer" dialog: paste a GetCapabilities URL (or the service base URL). The service type is detected.
- [ ] The capabilities are parsed and shown as a searchable layer list with titles, abstracts and preview thumbnails.
- [ ] The user picks layer, style, image format and tile matrix set / CRS. The best default is preselected: the view CRS if
      offered, else Web Mercator.
- [ ] XYZ URL template (`{z}/{x}/{y}`) is also accepted, for services without capabilities.
- [ ] Optional API key / extra query parameters (stored only locally in the project, and masked in the UI).
- [ ] The dialog checks CORS by requesting one tile and explains clearly if the service cannot be used
      (canvas export would fail).
- [ ] Attribution field (prefilled from capabilities, editable, required for export).
- [ ] Custom layers can be saved to a personal layer library (local storage) and reused in other projects.

## Dependencies
[STORY-16](./STORY-16-background-layers.md), [EN-13](../enablers/EN-13-layer-model-and-reprojection.md)

## Estimate
TBD
