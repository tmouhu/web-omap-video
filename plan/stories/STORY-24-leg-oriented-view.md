# STORY-24: Leg-oriented map view in course mode

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `animation`, `course`, `camera`

## User story
As an **orienteer**, I want **the map turned so that each leg runs from the bottom (the control I left) to the top
(the control I am heading to), with the whole leg and my route on it in view**, so that **the video reads like
a well-oriented map in my hand and the route choice is easy to follow**.

## Acceptance criteria
- [ ] Course mode turns on automatically when a valid course and matched GPX exist (can be switched off → free mode).
- [ ] Leg *i* goes from point *Pᵢ* (start or control *i*) to *Pᵢ₊₁* (next control or finish) and is active between their
      passing times ([STORY-22](./STORY-22-auto-match-gpx-to-course.md) / [STORY-23](./STORY-23-adjust-control-times.md)).
- [ ] **Orientation:** the map is rotated so the grid bearing from *Pᵢ* to *Pᵢ₊₁* points straight up on screen:
      *Pᵢ* is lower and *Pᵢ₊₁* upper, both on the vertical centre line of the safe area.
- [ ] **Framing:** the view is fitted to the union of
  - the **GPX segment of the leg** (from the passing time at *Pᵢ* to the passing time at *Pᵢ₊₁*), completely, and
  - *Pᵢ* and *Pᵢ₊₁* with a **margin** large enough for the course symbols and some surroundings
    (default: symbol radius + 8 % of the frame's short side, configurable),
  inside the frame's safe area ([STORY-1](./STORY-1-resizable-map-window.md)), measured in the rotated frame.
- [ ] The resulting scale is limited by the scale limits ([STORY-26](./STORY-26-scale-limits-and-panning.md)).
      If the leg is too large to fit at the zoom-out limit, panning applies (same story).
- [ ] During a leg the camera is **steady** (no constant following) unless panning or the approach zoom
      ([STORY-27](./STORY-27-approach-zoom.md)) is active.
- [ ] Time before the start passing time uses the first leg's view; time after the finish keeps the last leg's view, or shows
      the whole course (setting).
- [ ] Rotation is computed in the view CRS ([EN-12](../enablers/EN-12-coordinate-reference-systems.md)), so "up" is exact
      on the projected map.
- [ ] Implemented in the camera director ([EN-14](../enablers/EN-14-animation-timeline-camera.md)), with golden tests on a
      fixture course.

## Open questions / refinement
- When a route choice goes far "behind" the start control (route goes backwards), the fitted view becomes large.
  This is acceptable: the requirement says the whole route is shown.
- Should route choices drawn by the user ([STORY-30](./STORY-30-draw-route-choices.md)) also be included in the leg fit?
  Proposed: yes, while they are visible.

## Dependencies
[STORY-22](./STORY-22-auto-match-gpx-to-course.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate
TBD
