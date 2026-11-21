# STORY-23: Adjust GPX synchronisation to controls manually

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Must · **Labels:** `course`, `gpx`, `ui`

## User story
As an **orienteer**, I want to **correct the moment the GPX reaches a control** when the automatic matching is wrong
(e.g. the GPS shows me passing close to a control before I actually punched it), so that **the leg changes happen at the right time
in the video**.

## Acceptance criteria
- [ ] In the split table, each passing time can be:
  - nudged by ±1 s / ±0.1 s buttons and keys,
  - typed in (clock time or elapsed time),
  - set by clicking a point on the track on the map ("set passing here"),
  - set to the current playhead time ("set to now").
- [ ] Control markers in the timeline can be **dragged**; the map preview updates live and shows the position at that time.
- [ ] Manually set times are marked "manual" and kept when the automatic matching runs again. "Reset to automatic" per
      control and for all.
- [ ] Times must stay in course order. Invalid input is rejected with a message.
- [ ] Optional: import official split times (e.g. IOF XML `ResultList` or pasted text) to set the times; offset against the
      GPX clock can be adjusted. *(Could)*
- [ ] Changes update the camera plan ([EN-14](../enablers/EN-14-animation-timeline-camera.md)) at once.
- [ ] Undoable.

## Dependencies
[STORY-22](./STORY-22-auto-match-gpx-to-course.md), [STORY-3](./STORY-3-playback-controls.md)

## Estimate
TBD
