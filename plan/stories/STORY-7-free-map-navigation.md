# STORY-7: Pan, zoom and rotate the map when not playing

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `map`, `ui`

## User story
As a **user**, I want to **drag, zoom and rotate the map while playback is paused or stopped**,
so that **I can look at details, and draw and edit the course, the GPX and route choices accurately**.

## Acceptance criteria
- [ ] *(POC)* Pointer drag pans the map, also while the map is still rotating back to north.
- [ ] *(POC)* Mouse wheel zooms. **Change:** limits follow the active layers' resolutions (not fixed zoom 2–20), and zoom keeps
      the point under the cursor fixed.
- [ ] *(POC)* Pan and zoom are disabled during playback.
- [ ] Pinch-zoom and two-finger rotate on touch devices / trackpads.
- [ ] Rotate with Alt+drag or a rotation control; "reset north" button. Editors (course, route choices) work at any rotation.
- [ ] Buttons: "Fit track", "Fit course", "Fit current leg".
- [ ] In the editing workflow steps the map is in editing mode (no export framing); in preview it shows the exact video frame.

## POC reference
- `src/main.ts` – pointer and wheel handlers

## Open questions / refinement
- When playback resumes after panning, should the map jump back to the position (current behaviour) or animate?

## Dependencies
[EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate
TBD
