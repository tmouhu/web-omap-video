# STORY-3: Preview playback with speed and timeline controls

**Type:** Story · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `playback`, `ui`

## User story

As a **user**, I want to **play, pause, scrub and choose the playback speed**,
so that **I can check what the video will look like before exporting it**.

## Acceptance criteria

- [ ] _(POC)_ Play / Pause button; Space toggles playback.
- [ ] _(POC)_ Reset returns to the start.
- [ ] _(POC)_ Speed 1–30×, takes effect immediately. **Change:** default **1×** (head cam use case); presets
      1× / 2× / 5× / 10× / 30× plus a custom value; 0.5× for detail.
- [ ] _(POC)_ Timeline shows progress and allows seeking. Time label `elapsed / total`.
      **Change:** the timeline is the bottom panel of the app shell. It shows **control markers / leg segments**
      ([STORY-22](./STORY-22-auto-match-gpx-to-course.md)), the export range ([STORY-35](./STORY-35-export-time-range.md)) and
      optional mini graphs (pace, HR, elevation).
- [ ] _(POC)_ Playback follows real GPX time (including stops), interpolated between points, with smooth animation.
- [ ] Preview is **exactly what the export renders** at that time: it uses `frameStateAt(t)` from
      [EN-14](../enablers/EN-14-animation-timeline-camera.md).
- [ ] _(POC)_ Playback stops at the end. Pressing Play at the end restarts.
- [ ] Keyboard: ←/→ step 1 s (Shift: 10 s), `,`/`.` step one frame, `[`/`]` previous/next control, `J/K/L` shuttle.
- [ ] Clicking a leg in the timeline or in the course panel jumps to that leg's start.

## POC reference

- `src/main.ts` – `play`, `pause`, `seek`, `frame` (requestAnimationFrame loop)
- `src/track.ts` – `positionAt`, `indexAt`

## Technical notes

- Time step per frame is `dt × speed`; `dt` is capped at 250 ms to avoid jumps after the tab was in the background.

## Open questions / refinement

- Option to skip long stops automatically? (It would make the video stop matching the head cam in real time.)

## Dependencies

[STORY-2](./STORY-2-load-gpx.md), [EN-4](../enablers/EN-4-track-model-and-heading.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate

TBD
