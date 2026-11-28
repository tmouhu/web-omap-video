# STORY-45: Instant leg change (no transition animation)

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Should · **Labels:** `animation`, `camera`
· **Status:** approved (Nov 2026), implemented

## User story

As an **orienteer editing a highlight video**, I want **to switch off the turn/zoom animation between legs**, so that **the map
cuts straight to the next leg's view at the control**, and **slowing the sped-up map video down in the video editor does not
show a choppy transition**.

## Background

Transitions ([STORY-25](./STORY-25-leg-transitions.md)) last `transitionDuration` **video** seconds (default 1.5 s ⇒ 45
frames at 30 fps). When the user exports at e.g. 10× and slows a section down to 1× in DaVinci Resolve, those 45 frames are
stretched over 15 s: the rotation and zoom step visibly (or are blended by optical flow and smear). A hard cut has no
in-between frames, so it looks the same at any playback speed.

## Acceptance criteria

- [x] Camera setting **Leg change**: _Animated_ (default, today's behaviour) / _Instant_. Saved in the project and in presets.
- [x] With _Instant_, at the moment the transition would start (target passing + `transitionDelay`) the camera switches in one
      frame from the previous leg's view to the next leg's start view: rotation, scale and centre together. There are no
      in-between frames. The transition duration setting is hidden; the delay stays (it sets the cut moment).
- [x] The cut goes from the leg's end view (approach zoom or progressive zoom, [STORY-27](./STORY-27-approach-zoom.md),
      [STORY-42](./STORY-42-progressive-leg-zoom.md)) to the next leg's start view, i.e. the same end points as the animation.
- [x] Very short legs (next passing before the cut of the following leg): each leg still gets its own cut; nothing is
      skipped or merged unless the leg would be shown for less than one frame.
- [x] Route choices ([STORY-31](./STORY-31-route-choice-display.md)) with "appear at the transition" appear at the cut.
- [x] The tail, arrow and course are unaffected; time keeps running.
- [x] Intro / outro (course overview at the start and after the finish) follow the same setting. *(There is no intro yet; the overview after the finish cuts too.)*
- [x] The EN-14 continuity test allows exactly one discontinuity per leg change (at the cut frame) and none elsewhere.
- [x] Tiles for the next leg's view are prefetched before the cut ([EN-6](../enablers/EN-6-tile-prefetch.md)), so the
      first frame after the cut is complete in the export.
- [x] Pure function of (project, _t_): preview and export identical.

## Decisions (product owner, Nov 2026)

- **The approach zoom stays animated** with _Instant_. Only the leg change becomes a cut. The approach zoom
  (`approachDuration`), the progressive zoom and the route-framing ease keep their animation.

## Open questions / refinement

1. Optional short cross-fade (e.g. 3 frames) instead of a hard cut? Proposed: no – a cross-fade has the same problem when
   slowed, and editors can add a dissolve themselves.

## Dependencies

[STORY-25](./STORY-25-leg-transitions.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate

TBD
