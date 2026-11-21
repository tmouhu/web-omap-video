# STORY-21: Edit the GPX track to fix GPS errors

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Must · **Labels:** `gpx`, `editor`

## User story
As an **orienteer**, I want to **fix the obvious GPS errors in my track** (the line goes through a lake, cuts a corner or
is shifted from the path I ran), so that **the video shows the route I actually ran**.

## Acceptance criteria
- [ ] GPX edit mode with the track drawn with its points visible at large scales. A **time/pace/HR chart** below the map is
      linked to the map (hover/selection highlights in both).
- [ ] **Move points**: drag a single point; drag with a "soft brush" radius that moves neighbouring points with falloff.
- [ ] **Delete points** (single or range); time is preserved by interpolation.
- [ ] **Redraw a section**: select a time range and draw a new path. Timestamps are redistributed along the new path in
      proportion to distance, keeping the range's start and end times.
- [ ] **Shift section**: move a whole range by an offset (systematic GPS offset).
- [ ] **Snap to control** at the matched passing time ([STORY-22](./STORY-22-auto-match-gpx-to-course.md)): the track near
      the punch is warped smoothly so it passes through the control.
- [ ] **Outlier detection**: points with impossible speed/acceleration are highlighted and can be removed in one action.
- [ ] **Trim** start and end (e.g. warm-up, walk to the start).
- [ ] Time is never edited by moving points: the time of each point stays fixed, so the real-time alignment with the head cam is not affected.
- [ ] Edits are **non-destructive** operations on the original GPX ([EN-15](../enablers/EN-15-project-model-and-persistence.md)),
      undoable, with a "show original" toggle and "reset all edits".
- [ ] Distance, pace and derived data update after each edit ([EN-4](../enablers/EN-4-track-model-and-heading.md)).
- [ ] Export the edited track as GPX (extensions such as HR kept).

## Dependencies
[STORY-2](./STORY-2-load-gpx.md), [EN-4](../enablers/EN-4-track-model-and-heading.md), [EN-15](../enablers/EN-15-project-model-and-persistence.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate
TBD (candidate for splitting: basic edits / redraw / snap & outliers)
