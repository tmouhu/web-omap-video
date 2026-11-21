# EN-1: Geo math library (geodesy, bearing, scale ↔ zoom)

**Type:** Enabler (architecture) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `geo`

## Summary
A small module with the geographic calculations that rendering, playback, course logic, route-choice lengths and
recording all use. Projection code moves behind the CRS layer in [EN-12](./EN-12-coordinate-reference-systems.md).
This module keeps the CRS-independent maths.

## Scope / acceptance criteria
- [ ] *(POC)* Web Mercator `project` / `unproject` at fractional zoom (256 px tiles); round trip accurate to 1e-9°.
      **Change:** this becomes one implementation of the `Crs` interface in EN-12. It is no longer the only projection.
- [ ] *(POC)* Haversine `distance` and initial `bearing` (0° = north, clockwise).
- [ ] **Ellipsoidal (WGS84) geodesic distance** for anything shown to the user as a length (route choices, elapsed distance,
      leg length). It must match orienteering software (OCAD, Purple Pen, Livelox) within 0.1 %. Haversine may stay for
      internal heuristics.
- [ ] **Grid bearing** in the view CRS (`gridBearing(a, b, crs)`). It is used to orient legs so the target is exactly at
      screen-up (see [STORY-24](../stories/STORY-24-leg-oriented-view.md)).
- [ ] Scale ↔ resolution, generalised: `metersPerPixel(scale)` and `scaleForResolution(res, crs, point)`, which include the
      CRS point scale factor (Mercator `1/cos φ`; TM35/UTM ≈ 0.9996–1.0004).
      *(POC)* Web Mercator versions `zoomForScale` / `scaleForZoom` at 96 CSS px/inch are kept for tile-zoom selection.
- [ ] *(POC)* `angleDiff` (shortest signed difference) and `normalizeAngle`.
- [ ] Polyline helpers: length, point at distance, closest point on polyline (used by course matching and the GPX editor).
- [ ] *(POC)* Unit tests (`tests/geo.test.ts`), extended to the new functions; 100 % branch coverage; TSDoc.

## POC reference
`src/geo.ts`

## Technical notes
- Candidates: `geographiclib-geodesic` (Karney, exact) for geodesics; `proj4` via EN-12 for projections.
  Turf is not needed if these two are used.

## Dependencies
[EN-7](./EN-7-project-setup-ci.md)

## Estimate
TBD
