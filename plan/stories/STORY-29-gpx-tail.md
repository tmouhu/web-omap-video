# STORY-29: GPX tail with configurable length and pace colours

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `rendering`, `gpx`

## User story
As a **viewer**, I want to **see the route the runner just ran as a "tail" behind the arrow, coloured by pace**,
so that **I see the route and where the runner slowed down or hesitated**.

## Acceptance criteria
- [ ] **Tail length in seconds** (track time), e.g. 30 s, 60 s; special values "whole leg" and "whole route so far".
- [ ] The oldest part of the tail fades out (alpha gradient, setting), so the end does not cut off sharply.
- [ ] Colour modes:
  - **Single colour**
  - **By pace**: colour gradient by pace at each location (e.g. fast = green → slow = red), with thresholds either
    *relative* to the runner's median pace (default) or *absolute* min/km values
  - **By heart rate zone** (if HR is available) *(Should)*
- [ ] Optional legend for the colour scale (overlay, can be turned off).
- [ ] Pace values are smoothed ([EN-4](../enablers/EN-4-track-model-and-heading.md)), so GPS noise does not make the tail flicker.
- [ ] Line style: width (screen px at 1080p), outline/halo, round joins. Defaults do not clash with the course purple
      (the POC's purple/red track colours change).
- [ ] The **future part of the track is hidden** by default (no spoilers of the route choice). Option: show it faintly.
- [ ] Optional "previous legs" layer: completed legs shown thin and dimmed.
- [ ] Performance: the tail of 2 h at 1 Hz renders within the renderer's budget ([EN-2](../enablers/EN-2-canvas-map-renderer.md)).

## Technical notes
- The requirement text says "phase"; the product owner confirmed it means **pace (min/km)**.

## Dependencies
[EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-4](../enablers/EN-4-track-model-and-heading.md)

## Estimate
TBD
