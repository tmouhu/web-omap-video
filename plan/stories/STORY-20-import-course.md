# STORY-20: Import a course from IOF XML

**Type:** Story · **Epic:** [EPIC-3](../EPIC-3-course-and-gpx.md) · **Priority:** Could · **Labels:** `course`, `import`

## User story
As an **orienteer**, I want to **import the course file published by the organiser**, so that **I do not have to place every
control by hand**.

## Acceptance criteria
- [ ] Import **IOF XML 3.0 `CourseData`** (export format of OCAD, Purple Pen, Condes, OOM): controls with `Position`
      (lat/lng) and/or `MapPosition`, plus course sequences.
- [ ] If the file contains several courses, the user picks one.
- [ ] Controls with only `MapPosition` (map mm) are placed using the raster map's georeference and print scale.
- [ ] After import, the course can be edited as in [STORY-18](./STORY-18-set-course.md).
- [ ] Import report: number of controls, missing positions, warnings.
- [ ] Export the course as IOF XML 3.0.

## Open questions / refinement
- Purple Pen `.ppen` direct import?

## Dependencies
[STORY-18](./STORY-18-set-course.md)

## Estimate
TBD
