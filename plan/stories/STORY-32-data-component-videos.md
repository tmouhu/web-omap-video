# STORY-32: Data component videos synchronised with the map animation

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Must · **Labels:** `video`, `components`

## User story
As a **video editor**, I want **separate video files for each data component (elevation profile, pace, heart rate, elapsed
time, elapsed distance), each exactly in sync with the map video**, so that **I can place, size and style them freely over my
head cam footage**.

## Acceptance criteria
- [ ] Component framework: each component is a renderer `drawComponent(ctx, size, frameState, style)` that reads the same
      `frameStateAt(t)` as the map ([EN-14](../enablers/EN-14-animation-timeline-camera.md)).
- [ ] Components: **elevation profile** ([STORY-33](./STORY-33-elevation-profile.md)); **pace**, **heart rate**,
      **elapsed time**, **elapsed distance** ([STORY-34](./STORY-34-numeric-components.md)).
- [ ] Each component has its own enable toggle, output size (presets per component + custom) and style options.
- [ ] **Synchronisation guarantee:** all component videos and the map video of one export have the same export range, frame
      rate, frame count and start timestamp. Frame *n* in every file shows the same track time.
- [ ] **Background:** opaque, styleable (solid colour or card look with rounded corners and padding). No transparency:
      the files must work in any editor and player.
- [ ] Components that have no data (e.g. no HR in the GPX) are disabled with an explanation.
- [ ] Live preview of all enabled components in the app, next to the map, while scrubbing.
- [ ] Optional: a "composite preview" that lays the components over the map frame as a layout guide (not exported).

## Open questions / refinement
- Should components also be available as on-map overlays (burned into the map video) as an alternative? Proposed: yes, as a
  later story; the drawing code is the same.

## Dependencies
[EN-14](../enablers/EN-14-animation-timeline-camera.md), [EN-10](../enablers/EN-10-spike-offline-rendering.md)

## Estimate
TBD
