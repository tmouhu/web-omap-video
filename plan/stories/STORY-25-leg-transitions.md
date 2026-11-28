# STORY-25: Smooth transitions between legs

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `animation`, `camera`

## User story

As a **viewer**, I want **the map to turn, move and zoom smoothly from one leg's view to the next** when the runner punches a
control, so that **I keep my orientation and the video feels polished**.

## Acceptance criteria

- [ ] A transition starts at the control's passing time plus a configurable **delay** (default 0.5 s video time; may be
      negative to start slightly before the punch), and lasts a configurable **duration** (default 1.5 s video time).
- [ ] Rotation, scale and centre are interpolated together:
  - rotation the **short way round**,
  - scale in log space,
  - centre path that does not cut away from the content (e.g. van Wijk & Nuij smooth zoom-pan, or ease in screen space),
  - **ease-in-out** curve (selectable: ease-in-out cubic, sine, linear).
- [ ] **Time keeps running during the transition** (the runner keeps moving), so the video stays real-time and can be lined up with the head cam.
      The arrow and tail stay visible throughout.
- [ ] If the next leg is very short (shorter than the transition), transitions are merged or shortened; the camera never jumps.
- [ ] If an approach zoom ([STORY-27](./STORY-27-approach-zoom.md)) is active, the transition starts from the zoomed-in view.
- [ ] Optional **intro**: from a whole-course overview to the first leg view, using time before the start passing time
      (if there is any). Optional **outro** after the finish: zoom out to the whole route.
- [ ] Continuity test: no frame-to-frame change in rotation/scale/centre larger than the thresholds at 60 fps
      ([EN-14](../enablers/EN-14-animation-timeline-camera.md)).

## Open questions / refinement

- Option "pause time during transitions" for non-synced highlight videos? It would break real-time alignment with the head cam.

## Dependencies

[STORY-24](./STORY-24-leg-oriented-view.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate

TBD
