# STORY-22: Match the GPX to the course automatically

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Must · **Labels:** `course`, `gpx`, `algorithm`

## User story

As an **orienteer**, I want **the app to find when I was at the start, each control and the finish**,
so that **the leg-by-leg animation works without manual work**.

## Acceptance criteria

- [ ] Runs automatically when both a course and a GPX exist, and again after course or GPX edits (unless the user has made
      manual overrides – those are kept, see [STORY-23](./STORY-23-adjust-control-times.md)).
- [ ] For each control in course order, the passing time is the time of the **closest approach** within a search radius
      (default 50 m, configurable), with the constraint that passing times **increase in course order**. A global
      optimisation (dynamic programming over candidate local minima) is used, so controls visited more than once,
      crossing legs and butterfly loops are matched correctly.
- [ ] **Start** time: the last moment the track is within the radius of the start before heading to control 1
      (or the track start if never near). **Finish**: the closest approach to the finish after the last control
      (or the track end).
- [ ] Each match has a **confidence** (distance at closest approach, ambiguity). Controls with no candidate inside the radius
      are marked "not found" and get an estimated time (interpolated by distance). The UI points them out.
- [ ] Results shown as a split table: control, passing time, leg time, cumulative time, closest distance, status
      (auto / manual / not found).
- [ ] Results drive the timeline control markers ([STORY-3](./STORY-3-playback-controls.md)) and leg segments for the camera
      ([EPIC-4](../EPIC-4-course-animation.md)).
- [ ] Unit tests with fixture courses: normal, butterfly, control passed twice, missed control, GPS offset 30 m.
- [ ] Runs in < 200 ms for a 2 h track and 40 controls.

## Dependencies

[STORY-18](./STORY-18-set-course.md), [STORY-2](./STORY-2-load-gpx.md), [EN-4](../enablers/EN-4-track-model-and-heading.md)

## Estimate

TBD
