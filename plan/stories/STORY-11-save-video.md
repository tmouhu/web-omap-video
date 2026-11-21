# STORY-11: Save exported videos to disk

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `video`, `ui`

## User story
As a **user**, I want to **save the exported video(s) as files on my computer**, so that **I can use them in my video editor**.

## Acceptance criteria
- [ ] *(POC)* Uses the native "Save as" dialog (`showSaveFilePicker`) when available. Cancelling the dialog does nothing.
- [ ] *(POC)* Otherwise falls back to a regular browser download.
- [ ] Where the File System Access API is available, the user picks the destination **before** the export and the video is
      streamed straight to disk (no size limit from memory).
- [ ] *(POC)* Suggested file name: `<project-name>_<component>_<fps>fps_<width>x<height>.<ext>`
      (e.g. `Rastiviikko_map_30fps_1920x1080.mp4`, `Rastiviikko_hr_30fps_600x200.webm`).
- [ ] *(POC)* The file extension matches the container actually written.
- [ ] Multi-file export ([STORY-36](./STORY-36-export-package.md)): pick a folder once (`showDirectoryPicker`), or download a ZIP.
- [ ] *(POC)* E2E test checks the download name and a non-trivial file size.
- [ ] Exported WebM files have correct duration metadata, so players can seek in them.

## POC reference
- `src/main.ts` – save button handler; `src/recorder.ts` – `downloadBlob`

## Open questions / refinement
- Is the Web Share API (mobile share sheet) wanted?

## Dependencies
[STORY-9](./STORY-9-record-video.md)

## Estimate
TBD
