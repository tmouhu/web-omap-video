# STORY-40: Localisation (Finnish / English) and number formats

**Type:** Story · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Could · **Labels:** `i18n`, `ui`

## User story
As a **Finnish or international user**, I want **the UI and the video texts in my language with familiar number formats**,
so that **the app and the video feel native**.

## Acceptance criteria
- [ ] UI available in English and Finnish; language follows the browser with a manual switch.
- [ ] Video texts (labels in components, overlays, "Start"/"Finish") use a separately chosen **video language**.
- [ ] Number formats follow the video locale (e.g. `1,24 km` in Finnish, `1.24 km` in English); thousands separator handled.
- [ ] All strings extracted (i18n library), no hard-coded text; pseudo-locale test for truncation.

## Dependencies
[EN-16](../enablers/EN-16-ui-framework-design-system.md)

## Estimate
TBD
