# STORY-28: Show the position as a navigation arrow

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `rendering`, `marker`

## User story
As a **viewer**, I want **the runner's position shown as an arrow pointing in the direction of travel**, so that **I can see
which way the runner is heading, also when the map is not heading-up (course mode)**.

## Acceptance criteria
- [ ] The position marker is a **navigation arrow** (chevron style, like car navigation), replacing the POC's dot marker.
- [ ] The arrow points along the **normalized heading** ([EN-4](../enablers/EN-4-track-model-and-heading.md),
      30 m chord, smoothed in track time), drawn relative to the current map rotation.
- [ ] When standing still (no reliable heading), the arrow keeps the last heading, or turns into a dot after N seconds (setting).
- [ ] Style settings: size (screen px at 1080p, scaled with resolution), fill colour, outline/halo for contrast on any map,
      optional drop shadow. Defaults are readable on the orienteering map and on aerial imagery, and do not clash with the
      course purple.
- [ ] The arrow is drawn above the tail and the course, and is never clipped by overlays.
- [ ] Optional pulsing accuracy circle: off by default.

## Dependencies
[EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-4](../enablers/EN-4-track-model-and-heading.md)

## Estimate
TBD
