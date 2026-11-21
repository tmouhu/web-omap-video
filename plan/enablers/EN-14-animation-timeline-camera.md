# EN-14: Deterministic animation timeline and camera director

**Type:** Enabler (architecture) · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `tech`, `animation`

## Summary
One module answers "what does frame *t* look like?":
`frameStateAt(t) → { camera: { center, resolution, rotation }, runner: { position, heading }, legIndex, layerAlphas, … }`.
It is a **pure function** of the project (track, course, splits, settings) and the animation time `t`.
The preview, the export ([EN-10](./EN-10-spike-offline-rendering.md)), tile prefetch ([EN-6](./EN-6-tile-prefetch.md))
and the data component videos ([STORY-32](../stories/STORY-32-data-component-videos.md)) all use it, so they cannot drift
apart.

## Scope / acceptance criteria
- [ ] Time model: **track time** `t` (s since GPX start) ↔ **video time** `v` via `t = exportStart + v × speed`.
      Every user-facing animation duration (transition length, route-choice display time, fade) is given in
      **video seconds**.
- [ ] Camera modes:
  - **Free mode** (no course): follow the position, heading-up ([STORY-4](../stories/STORY-4-follow-position.md),
    [STORY-5](../stories/STORY-5-heading-up-rotation.md)).
  - **Course mode**: leg framing ([STORY-24](../stories/STORY-24-leg-oriented-view.md)), transitions
    ([STORY-25](../stories/STORY-25-leg-transitions.md)), scale limits and panning
    ([STORY-26](../stories/STORY-26-scale-limits-and-panning.md)), approach zoom
    ([STORY-27](../stories/STORY-27-approach-zoom.md)).
- [ ] Keyframes / leg plans are precomputed when the project changes (not per frame); `frameStateAt` evaluates them in O(log n).
- [ ] Interpolation primitives: rotation the short way round; zoom interpolated in log-resolution space; centre path
      that is smooth together with zoom (e.g. van Wijk & Nuij "smooth and efficient zooming and panning", or eased
      linear in screen space); configurable easing curves.
- [ ] Smoothing only in track/video time (no wall-clock state), so frame *n* is identical in preview and export.
- [ ] Safe-area insets (top/bottom/left/right in % of the frame) are part of the camera fit, so overlays or a
      picture-in-picture placement in the editor do not hide the course.
- [ ] Unit tests with golden `frameStateAt` values for a fixture course; property test: camera continuity
      (no jumps larger than a threshold between consecutive frames at 60 fps).
- [ ] Debug view: plot of scale / rotation over time, with leg boundaries (helps tuning, can be shown in the timeline UI).

## Dependencies
[EN-1](./EN-1-geo-math.md), [EN-4](./EN-4-track-model-and-heading.md), [EN-12](./EN-12-coordinate-reference-systems.md)

## Estimate
TBD
