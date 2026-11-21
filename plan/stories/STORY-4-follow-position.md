# STORY-4: Free mode – map follows the GPX position

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `playback`, `map`

## User story
As a **user without a course**, I want **the map to stay centered on the current GPX position while playing**,
so that **I can always see where the athlete is and what is around them**.

> When a course is set, the **course mode** camera in [EPIC-4](../EPIC-4-course-animation.md) is used instead.
> This story describes **free mode**, the camera mode used when no course is set.

## Acceptance criteria
- [ ] *(POC)* During playback the map center equals the interpolated GPX position on every frame (E2E-tested to 1e-6°).
- [ ] *(POC)* Movement is smooth (no tile flicker). Missing tiles are filled from lower-zoom tiles while loading.
- [ ] *(POC)* When paused, the user can pan away (see [STORY-7](./STORY-7-free-map-navigation.md)).
- [ ] *(POC)* Seeking while paused moves the map to the new position.
- [ ] "Look-ahead" offset: the marker sits below the center (configurable, default 20 % of frame height), so more of the route
      ahead is visible. Default on.
- [ ] Implemented as the free-mode camera of [EN-14](../enablers/EN-14-animation-timeline-camera.md).

## POC reference
- `src/main.ts` – `frame()` sets `state.view.center = track.positionAt(time)`
- `src/renderer.ts` – parent-tile fallback

## Open questions / refinement
- Should the camera be smoothed (damped) instead of locked to the position?

## Dependencies
[STORY-3](./STORY-3-playback-controls.md), [EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate
TBD
