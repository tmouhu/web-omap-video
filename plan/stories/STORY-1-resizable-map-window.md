# STORY-1: Video frame size with aspect presets

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `ui`, `map`

## User story

As a **user**, I want to **choose the aspect ratio of the map video and see the preview at exactly that framing**,
so that **the replay (and the exported video) fits where I will place it**, e.g. a corner of a 16:9 head cam video or 9:16 for stories.

## Acceptance criteria

- [ ] _(POC)_ The map window can be resized by dragging its bottom-right corner (minimum 160×120 px).
      **Change:** the preview frame is fitted into the central stage of the app shell
      ([STORY-37](./STORY-37-app-shell-and-workflow.md)). Its size comes from the chosen aspect ratio, with a custom
      handle that also works with touch.
- [ ] _(POC)_ Presets 16:9, 4:3, 1:1 and 9:16 resize the frame to the largest size of that ratio that fits the stage.
      Add 4:5 and 3:4 (common picture-in-picture shapes) and a **custom ratio**.
- [ ] _(POC)_ The current size and aspect ratio are shown (e.g. `796 × 446 px (1.785:1)`).
- [ ] _(POC)_ The map re-renders sharply after resize, including on HiDPI screens.
- [ ] _(POC)_ Frame changes are disabled during an export. The frame shows a "locked" outline.
- [ ] Safe-area guides can be shown on the frame (e.g. where the data components or a PiP border will sit).
      The insets feed into the camera fit ([EN-14](../enablers/EN-14-animation-timeline-camera.md)).
- [ ] The frame settings are stored in the project ([EN-15](../enablers/EN-15-project-model-and-persistence.md)).
- [x] Width/height can be typed in as exact numbers.
- [x] **Free resize (decision Nov 2026):** the frame's corner handle resizes it freely (Shift keeps the ratio); presets still
      fit the largest frame of that ratio into the stage.

## POC reference

- `index.html` (`#map-window`, `#aspect-buttons`), `src/style.css` (`.map-window { resize: both }`, `.locked`)
- `src/main.ts` – `ResizeObserver` on the canvas, aspect-button handler

## Technical notes

- **The ground area shown is defined by the aspect ratio and the scale, not by the on-screen pixel size.**
  The video at any resolution shows the same area as the preview (already true in the POC).

## Open questions / refinement

- Is a free-form (non-preset) window still needed, or are presets + custom ratio enough?
- Border for the map frame in the video? (No transparency, so rounded corners or shadows are done in the video editor.)

## Dependencies

[EN-2](../enablers/EN-2-canvas-map-renderer.md), [EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate

TBD
