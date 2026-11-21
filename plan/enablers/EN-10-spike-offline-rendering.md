# EN-10: Spike – faster-than-real-time, frame-exact video export (WebCodecs)

**Type:** Enabler (spike) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must (raised from follow-up) · **Labels:** `spike`, `video`

## Problem
With `MediaRecorder`, recording runs in real time: a 90 min run at 1× takes 90 min, and the tab must stay visible.
Frame timing also depends on how well the browser keeps up.
For head cam overlays the output must be **frame-exact at 1× for the whole run**. The map video and the data component videos
([STORY-32](../stories/STORY-32-data-component-videos.md)) must line up exactly with each other in a video editor
(DaVinci Resolve is the main target), and they must stay real-time to match the head cam.
This spike is therefore on the critical path.

## Hypothesis
Rendering frames deterministically (`t = start + n / fps × speed`) from the animation timeline
([EN-14](./EN-14-animation-timeline-camera.md)), encoding them with **WebCodecs `VideoEncoder`** and muxing with a library
(e.g. `mediabunny`, `mp4-muxer` / `webm-muxer`) can export:
- much faster than real time (limited by encoder speed),
- with exact frame timing and correct duration metadata,
- in a Worker, without needing a visible tab,
- streamed to disk (File System Access API / OPFS), so 90 min 1080p does not have to fit in memory.

## Spike goals (time-boxed, 3–4 days)
- [ ] Prototype: render N frames at fixed `dt` → `VideoFrame` → `VideoEncoder` (H.264 and VP9) → muxer → file stream.
- [ ] Measure export speed for 1080p and 4K versus real time, on a mid-range laptop.
- [ ] Tile strategy: wait for the tiles of frame N before rendering it, versus bulk prefetch ([EN-6](./EN-6-tile-prefetch.md)).
- [ ] Constant frame rate options: 25, 30, 50, 60 fps. Must match common head cam frame rates.
- [ ] Browser support check (WebCodecs: Chromium ✓, Firefox recent ✓, Safari partial) → update [EN-9](./EN-9-browser-compatibility.md).
- [ ] Check that the output (MP4/H.264, constant frame rate) opens and seeks correctly in DaVinci Resolve (main target) and in a standard player.
- [ ] Recommendation: WebCodecs primary with MediaRecorder fallback (expected), or other.

## Output
A decision record and a prototype branch. If the recommendation holds, [STORY-9](../stories/STORY-9-record-video.md) is
re-written as "Export video" on top of this path.

## Dependencies
[EN-2](./EN-2-canvas-map-renderer.md), [EN-14](./EN-14-animation-timeline-camera.md)

## Estimate
Time-box: 3–4 days
