# STORY-41: Import results (IOF XML 2.0 / 3.0) – leg sync and split comparison component

**Type:** Story · **Epic:** [EPIC-5](../EPIC-5-data-component-videos.md) (sync part touches [EPIC-3](../EPIC-3-course-and-gpx.md)) ·
**Priority:** Should · **Labels:** `import`, `course`, `video`, `components`, `results`

## User story
As an **orienteer**, I want to **import the official result file of the event**, so that **my control passing times come
from the punching system and the video can show how far I was behind or ahead of the leader on each leg and in total**.

## Background
Result services (e.g. Navisport) export a `ResultList` in both IOF XML versions. The two formats differ in ways the importer
must handle (observed in real exports of the same event):

| | IOF XML 2.0.3 | IOF XML 3.0 |
| --- | --- | --- |
| Root / version | `<ResultList>` + `<IOFVersion version="2.0.3"/>` | `<ResultList xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0">` |
| Class | `<ClassShortName>` | `<Class><Id/><Name/></Class>`, optional `<Course>` (length, number of controls) |
| Runner | `<Person><PersonName>`, club inside `<Person><Club>` | `<Person><Name>`, `<Organisation>` next to `<Person>` |
| Start / finish | Local wall-clock `HH:MM:SS`, **no date or time zone**, whole seconds; empty `<Clock/>` for DNF | ISO 8601 with time zone (`…T16:17:36.000Z`), sub-second |
| Times | `HH:MM:SS` strings | Seconds (number) |
| Status | `<CompetitorStatus value="OK|Disqualified|DidNotFinish|NotCompeting"/>` | `<Status>OK|MissingPunch|DidNotFinish|NotCompeting</Status>` |
| Missing punch | Split **omitted** (gap in `sequence`) | `<SplitTime status="Missing">` without `<Time>` |
| Finish | Split with `ControlCode` `M` (finish) as the last split | Same (`M`), plus `<FinishTime>` |

## Acceptance criteria

### Import
- [x] Import a `ResultList` in **IOF XML 2.0.3** and **IOF XML 3.0**; the version is detected automatically. Files can be
      dropped or picked like other inputs (the existing `.xml` route also accepts `CourseData`, so the importer looks at
      the root element).
- [x] If the file has several classes, the user picks the class. Then the user picks **their own result** from the class
      list (name / club / time, with search). The choice can be changed later.
- [x] Split times are normalised to one model: per competitor, start time (absolute, if known), status, and an ordered list of
      `{ controlCode, elapsed s | missing }`, with the finish as the last entry.
- [x] IOF 2.0 local clock times are converted using the event date and the time zone of the event location (fallback: the
      GPX's local offset); the user can correct the offset if it looks wrong.
- [ ] Import report: class, number of competitors, number with status OK, missing punches of the chosen runner,
      and warnings (for example, if the control codes do not match the course). *Partly: class list shows runners and
      controls per class; "n of m controls matched" with a warning; missing punches show as `–` in the splits table.*
- [x] Results are stored in the project (`ProjectDoc`, with a migration default) so they survive saving, reopening and
      autosave. Personal data of the other competitors is kept to what the comparison needs (name, status, splits).

### Leg synchronisation (course passing times)
- [ ] The result's control sequence is matched to the course **by control code** (`CoursePoint.code`). If the course has no
      codes, it is matched by position in the sequence when the number of controls matches; otherwise the user maps them.
      *Done except manual mapping: the user fixes unmatched controls by typing codes in the course list.*
- [ ] Optionally, a course with no controls can be created from the result's control sequence. The controls are unplaced
      and are positioned on the map afterwards.
- [x] The chosen runner's splits can be used as the **control passing times**: the punch times are converted into
      GPX-clock times (start time + split, with a user-adjustable clock offset between the punching system and GPS) and
      written as passing overrides, like manual times ([STORY-23](./STORY-23-adjust-control-times.md)). It is undoable.
- [x] The offset is suggested automatically by minimising the distance between the GPX positions and the control positions
      at the punch times, and it can be fine-tuned (±0.1 s steps). Residuals per control are shown, and controls with large
      residuals are highlighted.
- [x] Missing punches keep the automatic match ([STORY-22](./STORY-22-auto-match-gpx-to-course.md)) for that control.
- [x] Re-importing or changing the runner asks before overwriting manually adjusted passing times.

### Split comparison data (“difference to lead”)
- [x] For each control *i* of the chosen runner, the following are calculated from the competitors with valid times at that
      control:
  - **Leg difference** = runner's leg time *i* − fastest leg time *i* in the class (`+0:12`; `+0:00` = fastest).
  - **Total difference** = runner's elapsed time at *i* − best elapsed time at *i* in the class (the leader at that control).
  - Optional: leg rank and total rank at the control (`3.` / `5.`). *(done, "Show ranks" setting)*
- [x] Missing punches: a leg next to a missing punch has no leg time, so it is left out of the leg best and shows `–`. The
      total difference still works at later controls that are punched.
- [x] Setting: which competitors count for the reference (status OK only (default) / everyone with a time at that control).
      Could: compare against one chosen competitor instead of the leader, which gives signed `−/+` differences.
- [x] Unit tests with both formats of the same event give identical splits and differences (allowing for whole-second
      rounding in IOF 2.0).

### Split comparison component (video)
- [x] New data component **“Splits”** ([STORY-32](./STORY-32-data-component-videos.md)). At each control passing it shows
      the control number/code, the leg time and leg difference to the lead, and the total time and total difference to the
      lead. For example: `7 · 0:17 +0:02 · 5:08 +0:00`. The layout and fields can be turned on and off.
      *(Labels and ranks can be turned off; the fixed layout is control · leg · total.)*
- [x] Colours: the leader / fastest leg (`+0:00`) gets a highlight colour, and the time lost gets a neutral or warning
      colour. Uses tabular digits ([STORY-34](./STORY-34-numeric-components.md)) and the project's `videoLocale`.
- [x] **Visible only while the information is shown.** It appears at the control passing time, stays for a user-defined
      **display time** (default 5 s video time), then **fades out** over a user-defined **fade time** (default 0.5 s).
      There is a fade-in (default 0.3 s). The rest of the time the frame is a solid **key colour** (default `#00b140`,
      settable) that is removed in the editor with a chroma key; the fades blend the card over the key colour. Durations are in video seconds, and the alpha is a pure function of (project, t), so preview
      scrubbing and export match.
- [x] If the next control is passed before the display time ends, the panel switches to the new control (option: crossfade
      – not done).
- [x] The finish (`M`) is shown like a control, optionally with a longer display time and the final position.
- [x] The component is exported in the same pass and frame range as the map and the other components
      ([STORY-36](./STORY-36-export-package.md)), so it lines up with them in the editor when placed at the same position.
- [x] The component is disabled with a hint when there are no results, no runner is chosen, or there are no passing times.

## Decisions (product owner, Nov 2026)
- When nothing is shown, the frame is a **solid key colour** that the user removes with a chroma key in the editor (no alpha,
  decision 3). Default `#00b140` (broadcast green), settable per project.
- **Import by URL** is included: Navisport has a public result API (below), so the app imports from a Navisport event link,
  an event id or a search of Navisport events. Any other URL serving IOF XML also works if its server allows CORS.

## Navisport API (checked Nov 2026)
Public, no key, `access-control-allow-origin: *` (usable from the browser). Docs: `https://navisport.com/api/docs`
(OpenAPI at `/api/docs/reference.json`).
- `GET https://navisport.com/api/events?name=&dateFrom=&dateTo=&take=&orderBy=begin&direction=DESC` – event search.
- `GET https://navisport.com/api/events/{uuid}/results?format=iof-xml-3.0|iof-xml-2.0.3|json` – all classes of the event.
- Results are public only when the event is complete (403 before that).
- Event links use a slug (`/tapahtumat/<slug>/tulokset/…`) and the API takes only ids, so a slug is resolved by searching for its
  longest words (at most three requests) and matching the slug exactly.
- Requests are made only on user action (no polling).

## Open questions / refinement
- Could the same comparison also be drawn on the map frame? Decision 9 says “map, route and runner only”, so proposed: no.
  Only in the component.
- Course from the result's control sequence (unplaced controls) and manual control mapping: not done yet.
- Compare against one chosen competitor instead of the leader (signed `−/+`): not done yet.
- CSV split exports (OE/OS formats): out of scope for now.

## Dependencies
[STORY-18](./STORY-18-set-course.md), [STORY-22](./STORY-22-auto-match-gpx-to-course.md),
[STORY-23](./STORY-23-adjust-control-times.md), [STORY-32](./STORY-32-data-component-videos.md),
[STORY-36](./STORY-36-export-package.md), [EN-15](../enablers/EN-15-project-model-and-persistence.md)

## Test data
`tests/fixtures/results-v2.xml` / `results-v3.xml`: the same small, anonymised event in both versions (missing punch, DNF,
two classes). The real Navisport exports of one event (71 runners, 23 controls) were checked locally to give identical
splits in both versions; they are not committed (real names).

## Estimate
TBD
