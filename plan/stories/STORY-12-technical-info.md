# STORY-12: Show browser capability info

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Should · **Labels:** `ui`, `video`, `support`

## User story
As a **user (or support person)**, I want to **see which video features my browser supports**,
so that **I understand why my export uses a certain format or speed, and what to do about it**.

## Acceptance criteria
- [ ] *(POC)* "Technical info" section. **Change:** moved to a Help → "Browser capabilities" dialog, with a short
      summary in the export dialog ("Fast export available ✓", "H.264 ✗ – WebM will be used").
- [ ] *(POC)* Lists every codec candidate with ✓/✗ and highlights the one in use. Extended with WebCodecs encoders, File System Access, OffscreenCanvas/WebGL2.
- [ ] *(POC)* Feature checks: `MediaRecorder`, `canvas.captureStream()`, `showSaveFilePicker()` (with explanation).
- [ ] *(POC)* When a preferred capability is missing, a note explains the fallback and recommends a supported browser.
- [ ] *(POC)* Shows user agent and `devicePixelRatio`.
- [ ] If export is impossible, the Export button is disabled and the reason is shown.
- [ ] A "copy diagnostics" button for bug reports (no personal data, no GPX data).

## POC reference
- `index.html` (`#tech-info`), `src/main.ts` – `renderTechInfo()`

## Dependencies
[EN-5](../enablers/EN-5-recording-pipeline.md), [EN-9](../enablers/EN-9-browser-compatibility.md), [EN-10](../enablers/EN-10-spike-offline-rendering.md)

## Estimate
TBD
