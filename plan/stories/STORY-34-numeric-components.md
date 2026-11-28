# STORY-34: Numeric components – pace, heart rate, elapsed time, elapsed distance

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Must · **Labels:** `video`, `components`

## User story

As a **viewer**, I want to **see the runner's pace, heart rate, elapsed time and distance**, so that **I understand the effort
and progress at each moment of the head cam video**.

## Acceptance criteria

- [ ] **Pace**: min/km (`5:42 /km`), smoothed over a configurable window (default 10 s); shows `–:–` when standing still.
      Optional mini sparkline of the last N seconds.
- [ ] **Heart rate**: bpm, with optional zone colour (zones set by the user as bpm thresholds or % of max HR) and a pulsing
      heart icon. Disabled if the GPX has no HR.
- [ ] **Elapsed time**: from the start passing time (course mode) or from the export start; format `m:ss` below 1 h,
      `h:mm:ss` from 1 h. Before the start: negative countdown or hidden (setting). Optional leg split time.
- [ ] **Elapsed distance**: in **metres below 1 km** (e.g. `840 m`, whole metres) and in **kilometres from 1 km**
      (e.g. `1.24 km`, 2 decimals). Measured from the start passing point / export start, using the edited track.
      Optional: leg distance.
- [ ] Each component: label on/off, icon on/off, font, size, colours, alignment; uses tabular (monospaced) digits so numbers
      do not jump.
- [ ] Values are computed for the frame's track time with the same smoothing in preview and export.
- [ ] Number formatting is shared with the map info box ([STORY-8](./STORY-8-map-overlays.md)) and follows
      [STORY-40](./STORY-40-localisation-and-units.md).
- [ ] Unit tests for formatting edge cases: 999.6 m → `1.00 km` (no `1000 m`), 59:59.6 → `1:00:00`.

## Open questions / refinement

- One video per value (most flexible), or also a combined "dashboard" layout as one video? Proposed: both; single-value is the default.

## Dependencies

[STORY-32](./STORY-32-data-component-videos.md)

## Estimate

TBD
