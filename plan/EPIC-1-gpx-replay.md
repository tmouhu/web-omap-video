# EPIC-1: GPX replay and video export (POC baseline)

**Type:** Epic · **Status:** POC done → in refinement · **Labels:** `gpx`, `map`, `video`

## Summary
The foundation of the product: load a GPX, replay it on a map, and export the animation as a video file at a chosen
speed, frame rate and resolution. Most of this exists in the POC. This epic turns it into production quality and reshapes it
for the main use case: **map videos laid over orienteering head cam footage**. That means 1× speed, frame-exact output
and long (1–2 h) exports.

## Business goal / motivation
- Make it easy to review and share orienteering runs visually, without desktop software.
- Produce ready-to-edit videos directly from the browser.
- No backend needed: data stays on the user's device (privacy, zero hosting cost apart from map tiles).

## Scope (in)
- Video frame with aspect presets and safe areas.
- GPX upload incl. heart rate / elevation data.
- Preview playback with timeline (default 1×), the same as the export at every frame.
- Free mode (no course): follow position, heading-up rotation, fixed scale.
- Map overlays (scale bar, north arrow, attribution, info box, leg indicator).
- Frame-exact video export (WebCodecs, MediaRecorder fallback), format choice, saving to disk.
- Quality foundations: CI, tests, browser matrix.

## Scope (out, covered by other epics)
- Map sources, raster maps, coordinate systems → [EPIC-2](./EPIC-2-maps-and-coordinates.md)
- Course, GPX editing, control matching → [EPIC-3](./EPIC-3-course-and-gpx.md)
- Leg-based animation, arrow, tail, route choices → [EPIC-4](./EPIC-4-course-animation.md)
- Data component videos, export range → [EPIC-5](./EPIC-5-data-component-videos.md)
- App shell, design, projects → [EPIC-6](./EPIC-6-ux-and-project.md)

## Child issues
- Stories: [STORY-1](./stories/STORY-1-resizable-map-window.md) – [STORY-12](./stories/STORY-12-technical-info.md)
- Enablers: [EN-1](./enablers/EN-1-geo-math.md), [EN-2](./enablers/EN-2-canvas-map-renderer.md),
  [EN-4](./enablers/EN-4-track-model-and-heading.md) – [EN-10](./enablers/EN-10-spike-offline-rendering.md)

## Definition of done (epic level)
- All child stories accepted; enablers done or consciously deferred.
- Works in the supported browsers defined in [EN-9](./enablers/EN-9-browser-compatibility.md).
- Unit and E2E tests run in CI ([EN-7](./enablers/EN-7-project-setup-ci.md), [EN-8](./enablers/EN-8-test-strategy.md)).
- A 90 min run exports at 1080p / 30 fps frame-exact, faster than real time in Chromium.

## POC findings to carry forward
- Rendering a custom canvas map makes rotation and video capture simple and reliable. This must be re-checked against the
  new CRS/reprojection needs ([EN-2](./enablers/EN-2-canvas-map-renderer.md)).
- MediaRecorder runs in real time and needs a visible tab → WebCodecs export is now on the critical path
  ([EN-10](./enablers/EN-10-spike-offline-rendering.md)).
- Firefox can only record VP8 with MediaRecorder; Chromium records VP9/AV1/H.264.
- The POC's heading smoothing runs in wall-clock time; it must move to track time to be deterministic.

## Risks
| Risk | Mitigation |
| --- | --- |
| Long exports in real time | EN-10 WebCodecs, streaming to disk |
| Browser codec differences | EN-9 matrix + format presets (STORY-10) |
| Memory use with large videos | Stream to disk via File System Access API / OPFS |

## Estimate
TBD (sum of children after refinement)
