# STORY-33: Elevation profile component

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Must · **Labels:** `video`, `components`

## User story
As a **viewer**, I want **an elevation profile of the run with the current position marked**, so that **I can see the climbs
and where on them the runner is**.

## Acceptance criteria
- [ ] Profile of the export range: x-axis **distance** (default) or time, y-axis elevation (m), from smoothed GPX elevation
      ([EN-4](../enablers/EN-4-track-model-and-heading.md)).
- [ ] Current position marker moving along the profile; the completed part is filled/highlighted.
- [ ] Optional: control markers (vertical ticks with numbers) at the passing distances when a course is set.
- [ ] Optional: current elevation and total ascent labels.
- [ ] Optional: profile of the **current leg only** (rescales per leg with a smooth transition).
- [ ] Style: line and fill colours, font, axis labels on/off, background per [STORY-32](./STORY-32-data-component-videos.md).
- [ ] Default size 1200 × 300 (4:1) at 1080p reference; custom size allowed.
- [ ] Without elevation data, the component is disabled with an explanation.

## Open questions / refinement
- Replace noisy GPS elevation with a DEM (e.g. MML elevation model 2 m in Finland)? Proposed: later story.

## Dependencies
[STORY-32](./STORY-32-data-component-videos.md)

## Estimate
TBD
