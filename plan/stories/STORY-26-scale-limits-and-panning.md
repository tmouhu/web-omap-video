# STORY-26: Animation scale limits and panning

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Must · **Labels:** `animation`, `camera`, `settings`

## User story

As a **user**, I want to **set how far the animation may zoom in and out**, so that **the map stays readable on short legs
and long legs alike**. When a long leg does not fit at the zoom-out limit, I want **the map to pan along with the runner**.

## Acceptance criteria

- [ ] Two settings, shown as map scales 1:N with clear names (avoids the "large/small scale" confusion):
  - **Zoom-in limit** (largest scale, most detail), default 1:4 000
  - **Zoom-out limit** (smallest scale, least detail), default 1:15 000
    The zoom-in limit must be a larger scale than the zoom-out limit (validated).
- [ ] The limits are **always respected**: leg framing, transitions, approach zoom and the overview never go past them.
      (The intro/outro overview may have its own limit, setting.)
- [ ] **Too small to need zooming in further:** if the fitted scale for a short leg would be larger than the zoom-in limit, the
      zoom-in limit is used and the leg is centred.
- [ ] **Does not fit:** if the leg (route + leg points with margins) does not fit at the zoom-out limit, the camera stays at the
      zoom-out limit and **pans** during the leg:
  - orientation stays leg-oriented (target up),
  - the runner stays inside an inner safe box (e.g. middle 60 % of the frame), and the camera moves only as much as needed to
    keep it there (smooth, no jitter),
  - the camera does not move past the leg's bounding box (no empty space beyond the leg content),
  - at the start of the leg the start control is visible; when nearing the end, the target control is visible.
- [ ] Panning is smooth: camera centre filtered in track time, no visible stepping at 60 fps.
- [ ] The limits are part of the animation settings ([STORY-39](./STORY-39-animation-settings-and-presets.md)); a timeline
      debug graph shows the scale per frame and where panning is active.

## Dependencies

[STORY-24](./STORY-24-leg-oriented-view.md), [STORY-6](./STORY-6-playback-scale.md), [EN-14](../enablers/EN-14-animation-timeline-camera.md)

## Estimate

TBD
