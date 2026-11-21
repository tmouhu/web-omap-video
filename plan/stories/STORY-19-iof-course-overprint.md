# STORY-19: Show the course in IOF overprint style

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Must · **Labels:** `course`, `rendering`, `orienteering`

## User story
As an **orienteer**, I want **the course drawn exactly as on a printed orienteering map**, and I want to **show or hide it**,
so that **the video looks familiar and professional**.

## Acceptance criteria
- [ ] Symbols per the IOF course overprint specification (ISOM 2017-2, section "Course planning symbols"; ISSprOM 2019-2
      for sprint maps):
  - **Start**: equilateral triangle pointing towards control 1
  - **Control**: circle, centred on the control point
  - **Control number**: next to the circle, placed so it does not cover the legs
  - **Leg lines**: straight lines between symbols, **with gaps** at the circles/triangle
  - **Finish**: two concentric circles
- [ ] Dimensions are defined **in map millimetres at the map's print scale** and verified against the standard
      (forest ISOM reference values: start triangle 6.0 mm side, control circle 5.0 mm diameter, finish circles 5.0 and 7.0 mm,
      line width 0.35 mm, number height 4.0 mm – *to verify*). There is an ISOM / ISSprOM switch.
- [ ] Colour: IOF overprint purple (exact sRGB from the standard), drawn with *multiply* blending so map detail shows through.
- [ ] Without a raster map (no print scale), symbol size follows the current view scale with the 1:10 000 / 1:15 000 reference,
      clamped to a readable on-screen size. In the video, symbols keep a constant readable size during zoom transitions
      (setting: "Fixed screen size" / "Scale with map").
- [ ] Course visibility toggle: **shown / hidden** (in the layer panel and the course panel). Hidden still allows leg-based
      animation.
- [ ] Display option: whole course, or **current leg highlighted** with the other legs dimmed (default in course mode).
- [ ] Control numbers and codes are drawn upright whatever the map rotation.
- [ ] Visual regression test against a reference rendering ([EN-8](../enablers/EN-8-test-strategy.md)).

## Open questions / refinement
- Leg line gaps: the standard leaves out legs where they would cover important detail. Do we need manual "line break"
  edits per leg (as in Purple Pen / OCAD)? Proposed: later.

## Dependencies
[STORY-18](./STORY-18-set-course.md), [EN-2](../enablers/EN-2-canvas-map-renderer.md)

## Estimate
TBD
