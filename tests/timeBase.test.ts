import { describe, expect, it } from 'vitest';
import { CourseCamera, DEFAULT_COURSE_CAMERA } from '../src/lib/anim/courseCamera';
import { DEFAULT_ROUTE_DISPLAY, routeAlpha } from '../src/lib/anim/timeline';
import { appendPoint, emptyCourse, finishAtLast } from '../src/lib/course/course';
import { matchCourse } from '../src/lib/course/match';
import { presetForProject, BUILTIN_PRESETS } from '../src/lib/project/presets';
import { defaultSettings, migrate, type ProjectSettings } from '../src/lib/project/project';
import { convertSeconds, convertTimedSettings, timeScaleFor } from '../src/lib/project/timeBase';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

describe('time base (STORY-47)', () => {
  it('converts durations between video and real seconds', () => {
    expect(timeScaleFor('video', 10)).toBe(10);
    expect(timeScaleFor('real', 10)).toBe(1);
    expect(convertSeconds(1.5, 'video', 'real', 10)).toBe(15);
    expect(convertSeconds(15, 'real', 'video', 10)).toBe(1.5);
    expect(convertSeconds(3, 'video', 'video', 10)).toBe(3);
  });

  it('converts every timed setting, but not the pace window', () => {
    const s = defaultSettings();
    s.components[0].options.splitShow = 5;
    const r = convertTimedSettings(structuredClone(s), 'video', 'real', 4);
    expect(r.courseCamera.transitionDuration).toBe(s.courseCamera.transitionDuration * 4);
    expect(r.courseCamera.transitionDelay).toBe(s.courseCamera.transitionDelay * 4);
    expect(r.courseCamera.approachSeconds).toBe(s.courseCamera.approachSeconds * 4);
    expect(r.courseCamera.approachDuration).toBe(s.courseCamera.approachDuration * 4);
    expect(r.free.rotationSmoothing).toBe(s.free.rotationSmoothing * 4);
    expect(r.routeDisplay.hold).toBe(s.routeDisplay.hold * 4);
    expect(r.style.track.tailSeconds).toBe(s.style.track.tailSeconds * 4);
    expect(r.components[0].options.splitShow).toBe(20);
    expect(r.components[0].options.paceWindow).toBe(s.components[0].options.paceWindow);
    // Round trip.
    expect(convertTimedSettings(r, 'real', 'video', 4)).toEqual(s);
  });

  it('migrates old projects (mixed units) to video seconds with the same effect', () => {
    const old = {
      version: 1,
      settings: {
        speed: 10,
        courseCamera: { approachSeconds: 20, transitionDuration: 1.5 },
        style: { track: { tailSeconds: 60 } },
        routeDisplay: { hold: 30, fadeIn: 1, fadeOut: 5, timeBase: 'real' },
      },
    };
    const s = migrate(old).settings;
    expect(s.timeBase).toBe('video');
    expect(s.courseCamera.approachSeconds).toBeCloseTo(2, 9); // 20 real s at 10×
    expect(s.courseCamera.transitionDuration).toBe(1.5); // already video s
    expect(s.style.track.tailSeconds).toBeCloseTo(6, 9);
    expect(s.routeDisplay.hold).toBeCloseTo(3, 9);
    expect('timeBase' in s.routeDisplay).toBe(false);
    // Defaults filled in for missing keys are not converted.
    expect(s.courseCamera.approachDuration).toBe(DEFAULT_COURSE_CAMERA.approachDuration);
    // A project saved with a time base is left alone.
    const nu = migrate({ version: 1, settings: { ...s, timeBase: 'real', speed: 10 } }).settings;
    expect(nu.timeBase).toBe('real');
    expect(nu.courseCamera.approachSeconds).toBe(s.courseCamera.approachSeconds);
  });

  it('a migrated project renders the same camera and route timing', () => {
    const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });
    let c = emptyCourse();
    for (const [n, e] of [
      [0, 0],
      [0, 900],
      [600, 900],
    ])
      c = appendPoint(c, at(n, e));
    c = finishAtLast(c);
    const pts = [pt(0, 0, 0)];
    for (let i = 1; i <= 300; i++)
      pts.push(i <= 300 * (900 / 1500) ? pt(0, (i * 1500) / 300, i) : pt((i * 1500) / 300 - 900, 900, i));
    const tr = new Track('T', pts);
    const passings = matchCourse(tr, c);
    const speed = 10;
    const legacy = { approachSeconds: 40, approachEnabled: true, transitionDuration: 1 };
    // Before STORY-47: approach start in track s, transitions in video s (× speed).
    const s = migrate({ version: 1, settings: { speed, courseCamera: legacy } }).settings;
    const cam = (cs: ProjectSettings['courseCamera'], timeScale: number) =>
      new CourseCamera({
        track: tr,
        crsCode: 'EPSG:3067',
        course: c,
        passings,
        settings: cs,
        speed,
        timeScale,
        frame: { width: 800, height: 450 },
      });
    const migrated = cam(s.courseCamera, timeScaleFor(s.timeBase, speed));
    // Reference: the old semantics written out in track seconds with time scale 1.
    const ref = cam(
      { ...DEFAULT_COURSE_CAMERA, ...legacy, transitionDuration: 10, transitionDelay: 5, approachDuration: 20 },
      1,
    );
    for (let t = 0; t <= tr.duration; t += 2) expect(migrated.viewAt(t).view).toEqual(ref.viewAt(t).view);
    // Route display: 30 real s at 10× = 3 video s.
    const rd = { ...DEFAULT_ROUTE_DISPLAY, fadeIn: 2, hold: 30, fadeOut: 8 };
    const r = migrate({ version: 1, settings: { speed, routeDisplay: { ...rd, timeBase: 'real' } } }).settings;
    for (const t of [1, 20, 35, 50])
      expect(routeAlpha(t, 0, 1e9, r.routeDisplay, timeScaleFor(r.timeBase, speed))).toBeCloseTo(
        routeAlpha(t, 0, 1e9, rd, 1),
        9,
      );
  });

  it('presets: legacy presets keep their look, new presets carry their time base', () => {
    const sprint = BUILTIN_PRESETS.find((p) => p.id === 'sprint')!;
    const v = presetForProject(sprint.settings, 'video', 5);
    expect(v.courseCamera!.approachSeconds).toBeCloseTo(6 / 5, 9); // 6 real s
    expect(v.courseCamera!.transitionDuration).toBe(1); // video s
    expect(v.style!.track.tailSeconds).toBeCloseTo(30 / 5, 9);
    expect(v.timeBase).toBeUndefined(); // the project keeps its own time base
    const real = presetForProject(sprint.settings, 'real', 5);
    expect(real.courseCamera!.approachSeconds).toBe(6);
    expect(real.courseCamera!.transitionDuration).toBe(5);
    const own = presetForProject({ timeBase: 'real', courseCamera: { transitionDuration: 10 } as never }, 'video', 5);
    expect(own.courseCamera!.transitionDuration).toBe(2);
    expect(sprint.settings.courseCamera!.approachSeconds).toBe(6); // not mutated
  });
});
