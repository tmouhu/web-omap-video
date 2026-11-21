# EPIC-4: Course-aware map animation

**Type:** Epic · **Status:** In progress (Nov 2026) · **Labels:** `animation`, `camera`, `orienteering`

## Summary
When a course is set, the animation changes from "follow the runner" to **leg-by-leg storytelling**: for each leg, the map is
oriented so the leg's start is at the bottom and its target at the top, the whole leg route is in view, and the camera moves
smoothly between legs. The runner is shown as a navigation arrow with a pace-coloured tail, and the user's route choices
are shown with their lengths at the start of each leg before fading away.

## Business goal / motivation
- This is how orienteers read a map and analyse a race: leg by leg, with the map oriented to the leg.
- Route choice comparison is the most valued part of orienteering analysis.
- A steady, well-framed map is much easier to watch next to a shaky head cam image than a constantly turning one.

## Scope (in)
- Deterministic animation timeline and camera director ([EN-14](./enablers/EN-14-animation-timeline-camera.md)).
- Leg-oriented framing, smooth leg transitions, scale limits with panning, approach zoom.
- Navigation arrow, GPX tail with length and pace colours.
- Route choice drawing, display timing, fade, lengths in m / km.

## Scope (out, for now)
- Comparing several runners' routes on the same leg.
- Automatic route-choice suggestion (shortest path on the map).

## Child issues
- Stories: [STORY-24](./stories/STORY-24-leg-oriented-view.md) – [STORY-31](./stories/STORY-31-route-choice-display.md)
- Enablers: [EN-14](./enablers/EN-14-animation-timeline-camera.md)

## Definition of done (epic level)
- On the fixture course, every frame satisfies: target control above start control on the vertical axis (±0.5°), leg route
  and leg points inside the safe area, scale within limits (or panning active).
- No camera discontinuities (continuity test at 60 fps).
- Orienteers in the usability test rate the leg animation ≥ 4/5 for "easy to follow".

## Risks
| Risk | Mitigation |
| --- | --- |
| Camera behaviour feels "nervous" with real data | Tuning parameters in settings, debug graphs, track-time smoothing |
| Edge cases (very short legs, legs back past the start, loops) | Explicit rules in STORY-24/25/26, fixture tests |
| Label collisions with symbols and routes | Simple greedy placement first, iterate |

## Estimate
TBD
