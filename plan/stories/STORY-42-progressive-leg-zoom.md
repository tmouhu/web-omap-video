# STORY-42: Progressive leg zoom – frame the remaining route to the target

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Should · **Labels:** `animation`, `camera`
· **Status:** approved (Nov 2026), implemented

## User story
As an **orienteer**, I want **the leg view to zoom in gradually towards the target control as I get closer to it**, while
**the map always shows the route I still have to run**, so that **the end of the leg is shown in detail without losing the
overview of what is left**.

## Background
The current camera ([STORY-24](./STORY-24-leg-oriented-view.md)) fits the whole leg and keeps that scale until a short,
time-triggered approach zoom just before the punch ([STORY-27](./STORY-27-approach-zoom.md)). On long legs the last few
hundred metres are shown at the scale of the whole leg, and then the zoom happens late and quickly.

This story adds a camera mode where the framing follows the **remaining part of the leg**: the extent is the runner's route
from the current position to the target (plus the target control). As that remaining route gets shorter, the view zooms in
continuously.

## Acceptance criteria
- [x] New leg-zoom setting in the camera options: **Whole leg** (current behaviour, default) / **Zoom in towards the
      target**. Saved in the project and in presets.
- [x] With "Zoom in towards the target", the leg view at track time *t* is fitted to:
  - the runner's GPX route **from the position at *t* to the target passing** (the route actually run, so detours and
    route choices are included),
  - the target control (with its overprint symbol margin), and
  - the runner's position at *t*.

  The leg orientation (start → target up) and the margins stay the same as in the leg view.
- [x] The view only ever zooms **in** during a leg. If the remaining route extends sideways (e.g. a detour), the scale holds
      rather than zooming out again. The scale changes smoothly; there are no jumps when GPS points are noisy.
- [x] The scale is clamped by the zoom-in limit and zoom-out limit ([STORY-26](./STORY-26-scale-limits-and-panning.md)).
      **Zoom-in stop** setting: zooming in stops at a set scale (default 1:5 000), or earlier at the zoom-in limit.
- [x] **Start delay**: the zoom starts after a set share of the leg (default 0 % = from the leg start) or a set distance to
      the target (e.g. the last 300 m). Before that the whole leg is framed as now. *Implemented as the distance only
      ("last … m", 0 = from the leg start).*
- [x] Route choices ([STORY-31](./STORY-31-route-choice-display.md)) still take priority: while they are shown, the framing
      also includes them. The progressive zoom takes over as they fade out, using the same easing as the route framing.
- [x] Works together with panning: if the remaining route does not fit at the zoom-out limit, the camera pans as it does now.
- [x] Transitions ([STORY-25](./STORY-25-leg-transitions.md)) start from the zoomed-in end view of the leg and go to the
      next leg's start view.
- [x] When "Zoom in towards the target" is on, the fixed approach zoom ([STORY-27](./STORY-27-approach-zoom.md)) is not
      used (they would fight). The approach zoom settings are hidden.
- [x] Pure function of (project, *t*): preview scrubbing and export give identical frames; unit tests check that the
      remaining route, the target and the runner are inside the frame for sampled *t*, and that the scale is monotonic
      within a leg.

## Decisions (product owner, Nov 2026)
All three proposals below were accepted: the route actually run, an option next to the approach zoom ("Whole leg" stays
the default), and zoom in only.

## Open questions (resolved)
1. Should the frame use the **route actually run** (GPX from now to the target passing, which "knows the future"), or the
   **straight line** from the runner to the target? Proposed: the route actually run. It shows the runner's choice,
   and the video is made after the race.
2. Should it be a **third option** next to the time-based approach zoom, or **replace** it? Proposed: an option. The time-based
   zoom stays the default until this one has been tried on real races.
3. Is "zoom in only" right, or should the view be allowed to zoom out a little when the remaining route turns away (e.g.
   running past the control and coming back)? Proposed: zoom in only, and a looping route keeps the scale.

## Dependencies
[STORY-24](./STORY-24-leg-oriented-view.md), [STORY-26](./STORY-26-scale-limits-and-panning.md),
[STORY-27](./STORY-27-approach-zoom.md), [STORY-31](./STORY-31-route-choice-display.md),
[EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Implementation notes
`CourseCamera.zoomSeries(li)` precomputes each leg (≤ 600 samples): suffix boxes of the remaining GPX + target in leg
coordinates → fit; the scale follows the remaining distance log-linearly from the whole-leg fit (where the zoom
starts) to the stop scale at the target, never tighter than the fit (fitting the remaining route alone reached the
stop scale early in short legs, and the rest of the leg only panned) → suffix maximum (zoom in only) → forward exponential
smoothing in log space (≈ 1.5 video s; stays ≥ the fit so the content fits) → centre smoothed and clamped into the frame.
Where the remaining route does not fit at the zoom-out limit, the normal panning view is used.

## Estimate
TBD
