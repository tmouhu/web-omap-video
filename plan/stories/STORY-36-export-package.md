# STORY-36: Export the map and component videos together

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Must · **Labels:** `video`, `export`

## User story

As a **user**, I want to **export the map video and all enabled component videos in one go**, so that **I get a matching set of
files for my video editor without repeating the settings**.

## Acceptance criteria

- [ ] Export dialog: list of outputs (map + each enabled component) with checkboxes, size and estimated file size;
      shared range ([STORY-35](./STORY-35-export-time-range.md)), fps and speed.
- [ ] All outputs are standard **opaque** videos, MP4/H.264 by default (WebM/VP9 optional, [STORY-10](./STORY-10-video-quality.md)).
      No editor-specific formats or presets.
- [ ] Outputs are rendered in one pass over time (each frame state computed once and drawn to all outputs) or one after
      another. Progress shows the overall and per-output state. Cancel stops all.
- [ ] Saved to one folder chosen once, or as a ZIP ([STORY-11](./STORY-11-save-video.md)), with consistent names.
- [ ] A small `export.json` in the package records the range, the GPX clock time of the first frame, fps and settings, so the
      export can be repeated or checked later.
- [ ] Re-export after changes only renders the outputs that changed. _(Could)_

## Dependencies

[STORY-9](./STORY-9-record-video.md), [STORY-32](./STORY-32-data-component-videos.md), [STORY-35](./STORY-35-export-time-range.md)

## Estimate

TBD
