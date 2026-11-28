# STORY-8: Map overlays – north arrow only; credits outside the video

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `map`, `video`

## User story

As a **video maker**, I want **the map video to contain only the map, the route and the runner** (plus an optional north
arrow), so that **I can add time, distance, pace and other data as separate components where I want them**.

> **Decision (product owner, Nov 2026):** the map video has **no info box (time, distance, pace), no scale bar and no
> attribution**. Data values are separate component videos ([EPIC-5](../EPIC-5-data-component-videos.md)). Map credits
> required by the licences (MapAnt / MML CC BY 4.0, OSM ODbL) are shown in the app with a _Copy_ button, to be placed in the
> video description or end credits.

## Acceptance criteria

- [x] Info box removed from the frame (was _(POC)_). Values move to [STORY-34](./STORY-34-numeric-components.md).
- [x] Scale bar removed from the frame (was _(POC)_).
- [x] Attribution removed from the frame; the app shows the credits of all visible layers with a _Copy_ button.
- [x] _(POC)_ North arrow that rotates with the map, pointing to true north; can be switched off.
- [ ] North arrow mode: grid, true or magnetic north (magnetic default with an orienteering map) – [EN-12](../enablers/EN-12-coordinate-reference-systems.md).
- [ ] North arrow position (corner) and size; respects safe-area insets.
- [ ] Course mode: optional leg indicator ("4 → 5") – decide whether it stays in the frame or becomes a component.

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
