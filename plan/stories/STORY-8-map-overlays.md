# STORY-8: Map overlays – info box, scale bar, north arrow, attribution, leg indicator

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `map`, `video`

## User story
As a **viewer of the video**, I want to **see the key information directly on the map**,
so that **I understand what I am watching even without the separate data components**.

## Acceptance criteria
- [ ] *(POC)* Info box: elapsed time, distance, pace (10 s average), replay speed (e.g. `10×`). Can be switched off.
      **Change:** the info box is optional and off by default when data component videos
      ([STORY-32](./STORY-32-data-component-videos.md)) are exported, to avoid showing the same values twice. Field formatting
      (time, m/km) is shared with [STORY-34](./STORY-34-numeric-components.md).
- [ ] *(POC)* North arrow that rotates with the map. **Change:** it shows grid, true or magnetic north (setting; default
      magnetic when an orienteering map is loaded) – see [EN-12](../enablers/EN-12-coordinate-reference-systems.md).
      In course mode the north arrow matters more, because the map turns at each leg.
- [ ] *(POC)* Scale bar with a rounded distance (1/2/5 × 10ⁿ m) and the scale ratio.
- [ ] *(POC)* Map data attribution, always visible, including in videos (licence requirement). It lists all visible layers.
- [ ] *(POC)* Overlays are drawn on the canvas, so they appear in the video, scaled to the video resolution.
- [ ] Course mode: **leg indicator** (e.g. "Start → 1", "4 → 5", "12 → Finish") and leg split time, optional.
- [ ] Each overlay element can be switched on or off and positioned (corner) separately; overlays respect safe-area insets.
- [ ] Overlay style follows the video graphics style of [EN-19](../enablers/EN-19-ux-research-and-design.md).

## POC reference
- `src/renderer.ts` – `drawOverlays`, `formatScale`
- `src/main.ts` – `sceneInfo()`

## Open questions / refinement
- Branding/watermark option (club logo)?
- Localisation of number and time formats → [STORY-40](./STORY-40-localisation-and-units.md).
- Should the info box show the clock time of the original activity?

## Dependencies
[EN-2](../enablers/EN-2-canvas-map-renderer.md)

## Estimate
TBD
