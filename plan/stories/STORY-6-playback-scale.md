# STORY-6: Set map scale

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `map`, `playback`

## User story
As an **orienteer**, I want to **set the map scale as 1:N (e.g. 1:10 000)**,
so that **the replay matches the scales I am used to on orienteering maps**.

> In free mode this is the fixed playback scale. In course mode the camera picks the scale per leg, inside the
> **scale limits** of [STORY-26](./STORY-26-scale-limits-and-panning.md). Both use the scale definition below.

## Acceptance criteria
- [ ] *(POC)* Scale input `1:` + number, range 1:500 – 1:200 000, default 1:10 000, with presets
      (2 500, 4 000, 5 000, 7 500, 10 000, 15 000, 25 000, 50 000).
- [ ] *(POC)* Scale → resolution at 96 CSS px per inch of the preview frame.
      **Change:** the conversion goes through the view CRS ([EN-12](../enablers/EN-12-coordinate-reference-systems.md)),
      using its point scale factor. In Web Mercator this matches the POC (1:10 000 at 60.2°N ≈ zoom 14.84).
- [ ] *(POC)* Changing the scale while paused updates the map at once, centered on the current position.
- [ ] *(POC)* The scale bar and the scale ratio label are shown on the map.
- [ ] *(POC)* The scale is locked during export.
- [ ] *(POC)* The exported video covers the same ground area as the preview frame, whatever its resolution.
- [ ] When a raster orienteering map is loaded, its **print scale** (e.g. 1:10 000, entered or read from the georeference)
      is offered as a one-click preset, and the course symbol sizes use it ([STORY-19](./STORY-19-iof-course-overprint.md)).
- [ ] A help text explains that the on-screen scale depends on screen DPI.

## POC reference
- `src/geo.ts` – `zoomForScale`, `scaleForZoom`, `METERS_PER_CSS_PX`
- `src/main.ts` – `playbackZoom()`, scale input handler
- Tests: `tests/geo.test.ts`

## Open questions / refinement
- Should "scale" in the video be defined against a reference frame size instead (e.g. a 1080 px high frame on a 24" screen)?
  The video is usually shown smaller than full screen (picture-in-picture), so 1:N on the preview is only approximate.
- Screen calibration (e.g. match a credit card) for a physically true scale?

## Dependencies
[STORY-4](./STORY-4-follow-position.md), [EN-1](../enablers/EN-1-geo-math.md), [EN-12](../enablers/EN-12-coordinate-reference-systems.md)

## Estimate
TBD
