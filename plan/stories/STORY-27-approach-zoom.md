# STORY-27: Zoom in when approaching the control

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Should · **Labels:** `animation`, `camera`

## User story
As an **orienteer**, I want **the map to zoom in as the runner approaches the control**, so that **the viewer can see the
control "taking" (the final approach and the punch) in detail, as in the head cam**.

## Acceptance criteria
- [ ] Setting on/off (default on) with:
  - **Trigger**: time before the passing time (default 10 s track time) or distance to the control (default 60 m); time-based
    is the default because it is smooth and deterministic.
  - **Approach scale** (default 1:5 000), clamped by the zoom-in limit ([STORY-26](./STORY-26-scale-limits-and-panning.md)).
  - **Zoom duration / easing** (default 2 s video time, ease-in-out).
- [ ] During the approach, the view zooms towards a framing that contains the control and the runner (and the attack point
      area behind the runner), keeping the leg orientation.
- [ ] After the punch, the leg transition ([STORY-25](./STORY-25-leg-transitions.md)) starts from the zoomed-in view.
- [ ] If the leg is shorter than the trigger, the approach zoom starts at the leg start or is skipped (no zoom-in at the
      same moment as a transition).
- [ ] Can be turned off per control (e.g. for spectator controls or the finish).

## Dependencies
[STORY-24](./STORY-24-leg-oriented-view.md), [STORY-26](./STORY-26-scale-limits-and-panning.md)

## Estimate
TBD
