# EN-8: Test strategy and hermetic E2E tests

**Type:** Enabler (quality) · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `test`

## Summary

Define and set up the test pyramid: fast unit tests, renderer tests and browser E2E tests that need no network.

## Scope / acceptance criteria

- [ ] _(POC)_ Vitest unit tests for geo, GPX parsing (jsdom), track/heading and recorder helpers (23 tests).
- [ ] _(POC)_ Playwright E2E tests in Chromium:
      upload → play at 30× → centering/rotation/scale asserts → pause north-up;
      recording 1:1 at 480p → codec/bitrate status → video dimensions → download name and size.
- [ ] _(POC)_ Tile requests are stubbed with a CORS-enabled PNG, so the tests use no network.
- [ ] _(POC)_ App state is exposed as `window.__app` for test assertions. Production should use a test-only hook or data attributes instead.
- [ ] Unit tests for the new pure logic: CRS selection, georeferencing transforms, course matching, camera director
      (`cameraAt(t)` golden values), route-choice lengths, number formatting (m / km).
- [ ] E2E in Firefox (and WebKit where possible), with expectations per browser (codec).
- [ ] Visual regression tests for the renderer and the course overprint (screenshots with stubbed tiles),
      including leg transitions sampled at fixed `t`.
- [ ] Export test: a short deterministic export is decoded again and checked for frame count, duration and selected
      frames (pixel hash).
- [ ] Fixtures: real-world tracks (anonymised), no timestamps, multi-segment, very large, with HR; IOF XML courses;
      georeferenced raster maps (world file, KMZ, GeoTIFF) in TM35 and UTM; a course with a butterfly loop
      (control visited twice).
- [ ] Usability acceptance: key flows covered by the usability test in [EN-19](./EN-19-ux-research-and-design.md).
- [ ] Coverage reporting in CI with a minimum threshold.

## POC reference

`tests/`, `e2e/app.spec.ts`, `playwright.config.ts`, `vitest.config.ts`

## Dependencies

[EN-7](./EN-7-project-setup-ci.md)

## Estimate

TBD
