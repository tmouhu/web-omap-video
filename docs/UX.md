# UX design (EN-19)

## Personas and jobs

| Persona                              | Job to be done                                                    | Must be easy                                                               |
| ------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Orienteer with a head cam** (main) | Turn a race run into a map video to lay over the head cam footage | Load map + GPX + course, get a good default look, export frame-exact files |
| **Coach**                            | Explain route choices of a training leg                           | Draw route choices, keep them visible, slower camera                       |
| **Club media person**                | Highlight video of a race                                         | Presets, consistent style across runners ("New from this map")             |

Users are orienteers, not GIS or video specialists: GIS terms (CRS, WMTS) stay in advanced places with plain-language hints.

## Main journey → workflow rail

The left rail is the journey; steps can be visited in any order, each shows done / to do / optional / needs attention:

1. **Map** – background (MapAnt), orienteering map image (world file / KMZ / manual placement), layers, credits.
2. **GPX** – load the track, fix GPS errors.
3. **Course** – draw or import the course; splits matched automatically, adjust times.
4. **Routes** – route choices per leg and when they are shown.
5. **Style** – presets, camera, runner and tail, frame size, north arrow.
6. **Export** – data videos, time range, export (one folder, export.json).

Supporting UI: start screen / project library (autosaved projects, project files, sample project), top bar (project
name, save state, undo/redo, save file, theme, shortcuts), timeline (control markers, edit and export ranges, video view),
toasts for background work, `?` shortcut sheet.

## Principles

- **Preview = video.** "Video view" shows the exact export frame; editing tools switch to a north-up map.
- **Safe by default.** Undo everywhere, autosave, nothing uploaded, credits ready to copy.
- **Good result without tuning.** Defaults (MapAnt, course mode, smooth turns, pace tail) produce a usable video; presets
  for other styles; advanced camera settings behind "More settings…".
- **Accessible.** Keyboard for all playback/editing, visible focus, labelled controls, reduced-motion respected in the UI.

## Usability test plan (to run with ≥ 5 orienteers)

Task: "Make a video of this run" with a provided map (JPG + world file), GPX and IOF XML course.

- Success: map placed, course matched, ≥ 1 route choice, export of map + time component, in < 15 min without help.
- Observe: finding the rail order, understanding video view, setting zoom limits, export folder choice.
- Record: time per step, errors, SUS questionnaire. Feed findings into the backlog.
