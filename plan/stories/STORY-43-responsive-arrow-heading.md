# STORY-43: Responsive arrow heading – the arrow turns where the runner turns

**Type:** Story · **Epic:** [EPIC-4](../EPIC-4-course-animation.md) · **Priority:** Should · **Labels:** `rendering`, `marker`,
`gpx`, `bug` · **Status:** approved (Nov 2026), implemented and then **reverted** (Nov 2026, product owner) – the code was removed; the arrow uses the EN-4 heading (30 m / 1.5 s) again

## User story

As a **viewer**, I want **the navigation arrow to turn when and where the runner actually turns**, so that **the arrow shows the
real movement instead of sliding along the route while slowly rotating**.

## Background – investigation (Nov 2026)

Reported: "the map rotation normalisation also affects the symbol; the arrow is over-smoothed and slides along the route
without turning with it".

Findings:

- The **map rotation normalisation is not the cause.** The free-mode heading-up camera has its own dead band and smoothing
  (`Timeline.cameraBearing`, `rotationDeadband` 20°, `rotationSmoothing` 1.5 video s). The arrow does not use it: it is drawn
  from `FrameState.gridHeading` (`Track.headingAt` + grid convergence) relative to whatever the map rotation is
  (`drawRunner` in `scene.ts`). In course mode the camera is leg-oriented and not heading-based at all.
- **The arrow's own heading is over-smoothed – the problem is real.** `Track.headingAt` (EN-4) is the bearing of a
  **30 m chord centred** on the position, then a **zero-phase exponential filter** (τ = 1.5 track s, forward + backward pass).
  The same series also feeds the heading-up camera, which is why it was tuned for calmness.
- Measured on a synthetic 90° corner (4 m/s, 1 Hz GPX, corner at t = 50 s), heading in degrees for t = 40…60 s:

  | Chord / τ                  | t = 40 … 60 s                                               |
  | -------------------------- | ----------------------------------------------------------- |
  | **30 m / 1.5 s (current)** | 0 0 0 1 2 3 7 13 22 33 **45** 57 68 77 83 87 88 89 90 90 90 |
  | 10 m / 0.5 s               | 0 0 0 0 0 0 0 0 2 13 **45** 77 88 90 90 90 90 90 90 90 90   |
  | 6 m / 0.3 s                | 0 0 0 0 0 0 0 0 0 3 **45** 87 90 90 90 90 90 90 90 90 90    |

  With the current values the turn is spread over **≈ 12 s / 50 m**, and the arrow starts turning **≈ 25 m before the
  corner** (the centred chord and the backward filter pass look into the future). In a sprint or in technical forest the
  arrow therefore visibly points "inside" the corner and lags behind on the way out. Zig-zags shorter than ~30 m disappear.

## Proposed fix

Split the heading into two series with different purposes:

1. **Camera heading** (free-mode heading-up): keeps today's 30 m / 1.5 s series. Calm map rotation is wanted there.
2. **Arrow heading** (new `Track.arrowHeadingAt(t)`): short centred chord (default **12 m**) + light zero-phase smoothing
   (default τ **0.8 track s**) to remove GPS jitter. Standing still (chord < 1 m) keeps the last heading, as now.

`FrameState` gets both (`gridHeading` for the arrow, the camera keeps using its own); `sceneForFrame` passes the arrow heading
to `drawScene`. The setting is exposed as **arrow responsiveness** so users with noisy GPS can calm it down.

## Acceptance criteria

- [ ] The arrow uses its own heading series; the free-mode camera rotation is unchanged (same frames as before for the map).
- [ ] Style setting **Arrow responsiveness**: _Smooth_ (30 m / 1.5 s, today's look) · _Normal_ (12 m / 0.8 s, default) ·
      _Responsive_ (8 m / 0.4 s). Saved in the project and in style presets; old projects get _Normal_.
- [ ] Unit test, synthetic 90° corner at 4 m/s, 1 Hz: with _Normal_ the arrow has turned < 15° at 8 m before the corner and > 75° at 8 m after it.
- [ ] Unit test with GPS jitter (±2 m point-to-point noise; ±3 m uniform noise per axis gave up to 33° with 10 m / 0.5 s, so the defaults were raised to 12 m / 0.8 s on a straight line): with _Normal_ the arrow heading stays within ±20° of the
      true direction, and the frame-to-frame change at 30 fps stays below the stability limit in `realworld.test.ts`.
- [ ] Still a pure function of (project, _t_); preview and export identical.
- [ ] Checked on a real sprint GPX and a real forest GPX at 1×, 5× and 10× in the preview.

## Open questions / refinement

1. At high speeds (e.g. 10×) a 0.5 track-s filter is 0.05 video s, so GPS jitter may show as frame-to-frame flicker. Should the
   arrow filter have a minimum in **video** time (e.g. τ = max(0.5 track s, 0.1 video s))? Proposed: yes, if flicker is seen
   in the real-data check.
2. Should the chord adapt to speed (e.g. ~2.5 s of running) instead of a fixed distance? Proposed: no, distance is simpler and
   GPS error is a distance.

## Dependencies

[EN-4](../enablers/EN-4-track-model-and-heading.md), [STORY-28](./STORY-28-navigation-arrow.md),
[STORY-5](./STORY-5-heading-up-rotation.md)

## Estimate

TBD
