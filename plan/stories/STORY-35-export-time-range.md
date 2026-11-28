# STORY-35: Set the export time range

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Must · **Labels:** `video`, `export`

## User story

As a **user**, I want to **choose which part of the run is exported**, so that **the map and component videos cover the part I
need and I can line them up with my head cam footage in my video editor**.

> Syncing with the head cam video happens in the video editor. The app does not load or analyse head cam videos.

## Acceptance criteria

- [ ] Range presets: **course start → finish** (default when a course is set), **whole track**, **custom**.
- [ ] Custom range: drag in/out handles on the timeline, set to the playhead (`I` / `O` keys), or type clock times
      (`hh:mm:ss`) or elapsed times.
- [ ] Optional lead-in / lead-out padding (e.g. 10 s before the start), shown with the first/last state.
- [ ] The range, the GPX clock time of the first frame and the frame rate are shown in the export dialog, so the user can
      line the videos up in the editor (e.g. against the head cam clock).
- [ ] The map video and all component videos of one export use **the same range, frame rate and frame count**.
- [ ] The range is saved in the project.

## Dependencies

[EN-14](../enablers/EN-14-animation-timeline-camera.md), [STORY-3](./STORY-3-playback-controls.md), [STORY-22](./STORY-22-auto-match-gpx-to-course.md)

## Estimate

TBD
