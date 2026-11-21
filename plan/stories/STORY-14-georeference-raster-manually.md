# STORY-14: Georeference a raster map manually with control points

**Type:** Story · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `map`, `georef`, `ui`

## User story
As a **user with a map image that has no georeference** (scan, photo, PDF), I want to **place it on the background map by
matching a few points**, so that **the map and my GPX line up**.

## Acceptance criteria
- [ ] Split view: raster image on one side, background map (aerial or topographic) on the other. Each side can be panned,
      zoomed and rotated on its own. An overlay mode with adjustable transparency is also available.
- [ ] The user adds **point pairs** by clicking the same feature on both sides (path crossing, building corner…).
      Pairs are numbered and listed; they can be moved, renamed and deleted.
- [ ] Quick start: "rough placement" – drag, rotate and scale the semi-transparent image over the background map, then refine
      with point pairs.
- [ ] Transform types:
  - **2 points:** similarity (shift, rotation, uniform scale)
  - **3+ points:** affine (default) or similarity with least squares
  - **6+ points (advanced):** 2nd-order polynomial for scanned or distorted maps
- [ ] Per-point residual (m) and RMS error are shown; the worst point is highlighted. A warning appears when RMS > 5 m.
- [ ] Optional **GPX-assisted** points: click a point on the image and a point on the GPX (e.g. a distinctive corner) instead
      of the background map.
- [ ] The transform is estimated in the view CRS ([STORY-15](./STORY-15-view-crs-selection.md)), so the result is accurate
      in metres.
- [ ] The print scale is estimated from the transform and the image DPI, and offered as a suggestion.
- [ ] Georeference can be exported as a world file + `.prj`, for reuse in other tools.
- [ ] All steps are undoable ([EN-15](../enablers/EN-15-project-model-and-persistence.md)).

## Open questions / refinement
- Magnifier loupe while placing points (precise clicks on a high-DPI map)?
- Automatic matching of map features to imagery: out of scope.

## Dependencies
[STORY-13](./STORY-13-add-raster-map.md), [STORY-16](./STORY-16-background-layers.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate
TBD
