# STORY-46: Leg transitions as separate real-time clips

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) · **Priority:** Could · **Labels:** `export`,
`animation`, `camera` · **Status:** approved (Nov 2026), implemented (CSV clip list; EDL/FCPXML not done)

## User story

As an **orienteer editing a highlight video**, I want **the export to produce each leg transition as its own clip rendered at
real-time speed (1×)**, while **the main map video stays sped up**, so that **when I slow a control passing down to 1× in the
video editor I can drop in a clip with a smooth, full-frame-rate transition**.

## Background

The main map video is exported at the project speed (e.g. 10×). Sections the user slows down to 1× in the editor have
1/10 of the needed frames ([STORY-45](./STORY-45-instant-leg-change.md) solves this with a cut; this story keeps the
animation). A transition clip is rendered with the **same camera as the main video** outside the transition, so it can be
cut in and out of the main video anywhere in its padding without a visible jump.

## Acceptance criteria

- [x] Export option **Transition clips at real time (1×)**, off by default, available in course mode. Saved in the project.
- [x] For each leg change _i_ (and intro/outro if enabled) the export writes one extra map video:
  - covers track time **[cut/transition start − pre-roll, end of the main video's transition + post-roll]**, pre/post-roll
    default 3 s each (setting), clamped to the export range;
  - rendered at **1×** (one frame per 1/fps track seconds), same size, fps, codec and layers as the main map video;
  - the leg change inside the clip is animated over `transitionDuration` **real** seconds (e.g. 1.5 s = 45 frames at 30 fps);
  - **outside that animation every frame is identical to the main video's frame at the same track time** (all other
    speed-dependent settings – route display, approach zoom, progressive-zoom smoothing, tail – use the project speed).
- [x] Works with both _Animated_ and _Instant_ leg changes in the main video ([STORY-45](./STORY-45-instant-leg-change.md));
      with _Instant_ the clip's padding can be short because the main video jumps in one frame.
- [x] File names say where the clip belongs: control number, track-time start and the **main-video timecode** where the clip's
      first frame lines up when that section is slowed to 1× (e.g. `run_leg03-04_rt_t00-12-34.500_main00-01-15.12_30fps…mp4`).
- [x] A **clip list** (CSV, and optionally an EDL / FCPXML that DaVinci Resolve can import as markers) lists every clip with its
      main-video in/out timecode, track-time range and leg.
- [x] Rendered in the same export pass or a follow-up pass of `exportPackage`, streamed to files (never in memory); progress
      shows the clips; cancelling stops everything.
- [x] Frame-exactness test: for sampled frames in a clip's padding, the clip frame equals the main video frame at the same
      track time (pixel hash on a stub map).

## Technical notes

- The camera needs two speeds: the **camera speed** (project speed, defines every video-second setting) and a
  **transition speed** override (1 for the clip). `CourseCamera` takes `speed`; add an optional `transitionSpeed` used only for
  `transitionDelay` / `transitionDuration` (and, if chosen, intro/outro). The exporter's frame clock (`t = start + n·speed/fps`)
  already supports any render speed.
- Clips only need the map output; data components are not repeated (decision below).

## Decisions (product owner, Nov 2026)

- **No real-time data components.** Clips are made for the map video only. Pace, time, distance and the other components are
  exported only at the project speed.

## Open questions / refinement

1. Pre-roll/post-roll defaults (3 s) – enough room for the editor cut?
2. Is a timecode in the file name enough, or must the clip carry a start timecode track (Resolve reads MOV `tmcd`)?
   Proposed: file name + clip list first; timecode track only if mediabunny supports it easily.
3. Generalise to "export any time range as a 1× clip" instead of transitions only? Proposed: transitions first, the range
   picker of [STORY-35](./STORY-35-export-time-range.md) could reuse the same code later.

## Dependencies

[STORY-25](./STORY-25-leg-transitions.md), [STORY-36](./STORY-36-export-package.md),
[STORY-45](./STORY-45-instant-leg-change.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate

TBD
