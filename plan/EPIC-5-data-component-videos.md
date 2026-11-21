# EPIC-5: Data component videos

**Type:** Epic · **Status:** New → in refinement · **Labels:** `video`, `components`

## Summary
Besides the map, produce **separate video files** from the GPX data: elevation profile, pace, heart rate, elapsed time and
elapsed distance. They are frame-exactly synchronised with the map animation and exported together with it.

## Business goal / motivation
- The user combines the map animation and the components with their head cam footage in a video editor
  (DaVinci Resolve is the main target). Separate files give full freedom of layout.
- **The output has no dependency on any editor:** standard, opaque video files (MP4/H.264 by default). Syncing with the head
  cam video is done in the editor and is out of scope for the app.

## Scope (in)
- Component framework, elevation profile, numeric components (pace, HR, time, distance).
- Export time range shared by the map and all components.
- Export package (all outputs in one go).

## Scope (out)
- Head cam video loading, offset and sync in the app (done in the video editor).
- Transparent (alpha) video output. Components use a solid, configurable background.
- Rendering a combined video (head cam + map) in the browser.
- Audio.

## Child issues
- Stories: [STORY-32](./stories/STORY-32-data-component-videos.md) – [STORY-36](./stories/STORY-36-export-package.md)
- Enabler: [EN-10](./enablers/EN-10-spike-offline-rendering.md) (from EPIC-1)

## Definition of done (epic level)
- An export package (map + all components) of a 60 min run imports into DaVinci Resolve. When the files are placed at the
  same timeline position, they stay in sync with each other from the first to the last frame.
- The same files also play correctly in a standard player (VLC, QuickTime) and in at least one other editor.
- Components render correctly with and without HR/elevation data.

## Risks
| Risk | Mitigation |
| --- | --- |
| Export time for several outputs | Single-pass rendering, WebCodecs in Workers |
| Components look poor on the head cam image without transparency | Styleable solid background (colour, rounded card look); in Resolve they can be cropped or keyed if needed |

## Estimate
TBD
