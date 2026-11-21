# EN-9: Browser compatibility matrix

**Type:** Enabler (research / quality) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Should · **Labels:** `tech`, `compat`, `video`

## Summary
Define the supported browsers and document their capabilities, so that fallbacks and UI messages are correct.

## Findings so far (POC, Nov 2026)

| Capability | Chromium 159 (Chrome/Edge) | Firefox 159 | Safari |
| --- | --- | --- | --- |
| `MediaRecorder` VP9 (WebM) | ✓ | ✗ | to verify |
| `MediaRecorder` VP8 (WebM) | ✓ | ✓ | to verify |
| `MediaRecorder` AV1 (WebM) | ✓ | ✗ | to verify |
| `MediaRecorder` H.264 (MP4) | ✓ | ✗ | to verify (expected ✓) |
| `canvas.captureStream()` | ✓ | ✓ | to verify |
| `showSaveFilePicker()` | ✓ | ✗ (download fallback) | ✗ (expected) |
| WebCodecs `VideoEncoder` (H.264 / VP9 / AV1) | to verify | to verify | to verify |
| OffscreenCanvas + WebGL2 in Worker | to verify | to verify | to verify |
| Max canvas area / `createImageBitmap` of large images | to verify | to verify | to verify (canvas area limit is known to be low) |

## Scope / acceptance criteria
- [ ] Supported browser list agreed. Proposal: latest 2 versions of Chrome, Edge and Firefox on desktop; Safari on desktop is
      best effort. Mobile is view-only (see [EPIC-6](../EPIC-6-ux-and-project.md)).
- [ ] Matrix above completed and kept in the docs.
- [ ] Behaviour verified per browser: export, saving, HiDPI rendering, file drop, resizing, large raster loading.
- [ ] The in-app Technical info ([STORY-12](../stories/STORY-12-technical-info.md)) matches the matrix.
- [ ] Unsupported-browser message defined.

## Dependencies
None

## Estimate
TBD
