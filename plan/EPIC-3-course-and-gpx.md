# EPIC-3: Orienteering course and GPX alignment

**Type:** Epic · **Status:** In progress (Nov 2026) · **Labels:** `course`, `gpx`, `orienteering`

## Summary
Let users set the orienteering course (start, controls, finish), show it in IOF overprint style, fix GPS errors in their track,
and connect the track to the course: automatically find the passing time at each control, with manual correction.

## Business goal / motivation
- The course is what turns a GPS replay into an orienteering analysis: legs, route choices, splits.
- Accurate passing times drive the leg-based animation ([EPIC-4](./EPIC-4-course-animation.md)) and the split display.
- GPS errors in forests are common. Videos look wrong (running through a lake) unless they can be fixed.

## Scope (in)
- Course creation and editing; IOF-standard visualisation; show/hide.
- GPX editor (move, delete, redraw, shift, snap to control, outliers, trim) – non-destructive.
- Automatic GPX ↔ course matching with confidence; manual adjustment of passing times.
- IOF XML course import (*Could*).

## Scope (out, for now)
- Score-O / free-order courses, relays with forking.
- Multiple runners on the same course in one video.

## Child issues
- Stories: [STORY-18](./stories/STORY-18-set-course.md), [STORY-19](./stories/STORY-19-iof-course-overprint.md),
  [STORY-20](./stories/STORY-20-import-course.md), [STORY-21](./stories/STORY-21-gpx-editor.md),
  [STORY-22](./stories/STORY-22-auto-match-gpx-to-course.md), [STORY-23](./stories/STORY-23-adjust-control-times.md)

## Definition of done (epic level)
- A 20-control course is set in < 3 min by a test user ([EN-19](./enablers/EN-19-ux-research-and-design.md)).
- The course rendering passes a side-by-side review against an OCAD/Purple Pen print of the same course.
- Automatic matching is correct for ≥ 95 % of controls on the fixture set without manual edits.

## Risks
| Risk | Mitigation |
| --- | --- |
| Matching fails on butterfly courses / crossing legs | Global ordered optimisation + fixtures (STORY-22) |
| GPX editor scope creep | Split STORY-21 into basic / advanced during refinement |
| IOF symbol details (gaps, number placement) take long | Start with the core symbol set, iterate with orienteers |

## Estimate
TBD
