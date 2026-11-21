# STORY-9: Export the map animation as a video

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `video`

## User story
As a **user**, I want to **export the map animation as a video file at the selected speed, frame rate and resolution**,
so that **I can lay it over my head cam footage or share it**.

## Acceptance criteria
- [ ] *(POC)* The video contains only the map frame (incl. overlays), not the surrounding UI.
- [ ] *(POC)* The video keeps the frame's aspect ratio. Resolution is chosen by the short side: 360p, 480p, 720p,
      1080p (**new default**), 1440p, 2160p.
- [ ] *(POC)* Dimensions are even numbers. The long side is capped at 3840 px; if the cap applies, the short side
      is reduced so the aspect ratio stays the same (unit-tested).
- [ ] *(POC)* The video size is shown before export (e.g. `Video: 1920 × 1080`).
- [ ] *(POC)* The video shows the same ground area as the preview. Lines, symbols and text scale with the resolution.
- [ ] Frame rate selectable: 25, 30, 50, 60 fps (default 30; choose the head cam's frame rate for the easiest editing).
- [ ] **Export range**: whole track, start→finish of the course (default when a course is set), or a custom range
      ([STORY-35](./STORY-35-export-time-range.md)). Replaces the POC's "Record from start" option.
- [ ] **Frame-exact**: the video has exactly `round(duration × fps / speed)` frames, and frame *n* shows `t = start + n × speed / fps`.
- [ ] Faster than real time where WebCodecs is available ([EN-10](../enablers/EN-10-spike-offline-rendering.md));
      real-time MediaRecorder fallback otherwise ([EN-5](../enablers/EN-5-recording-pipeline.md)), with the warning that
      the tab must stay visible.
- [ ] *(POC)* Map tiles are ready before each frame is rendered (no blank tiles) – [EN-6](../enablers/EN-6-tile-prefetch.md).
- [ ] Progress (frames, %, estimated time left) and Cancel without producing a file.
- [ ] Editing that would change the output is locked during export, or the export runs on a snapshot of the project.
- [ ] *(POC)* A preview player shows the finished video together with its file size.
- [ ] An estimated export time and file size are shown before starting.

## POC reference
- `src/recorder.ts` – `computeVideoSize`, `CanvasRecorder`
- `src/main.ts` – `startRecording`, `stopRecording`, dual render in `frame()`
- Tests: `tests/recorder.test.ts`, `e2e/app.spec.ts` (480×480 recording, dimension check)

## Open questions / refinement
- Optional intro/outro (course overview before start, whole route after finish)? It can only use the time before the start / after the finish,
  so the video stays in real time – see [STORY-25](./STORY-25-leg-transitions.md).
- Maximum export length / disk space guard?

## Dependencies
[STORY-3](./STORY-3-playback-controls.md), [EN-10](../enablers/EN-10-spike-offline-rendering.md),
[EN-5](../enablers/EN-5-recording-pipeline.md), [EN-6](../enablers/EN-6-tile-prefetch.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate
TBD
