import { describe, expect, it } from 'vitest';
import {
  CourseCamera,
  DEFAULT_COURSE_CAMERA,
  lerpAngle,
  type CourseCameraSettings,
} from '../src/lib/anim/courseCamera';
import { DEFAULT_ROUTE_DISPLAY, routeAlpha, Timeline, DEFAULT_FREE_MODE } from '../src/lib/anim/timeline';
import { appendPoint, emptyCourse, finishAtLast, type Course } from '../src/lib/course/course';
import { matchCourse } from '../src/lib/course/match';
import { forward, pointScale } from '../src/lib/geo/crs';
import { groundResolutionForScale } from '../src/lib/geo/geo';
import { makeTransform } from '../src/lib/render/scene';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

const CRS = 'EPSG:3067';
const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });
function course(...xy: [number, number][]): Course {
  let c = emptyCourse();
  for (const [n, e] of xy) c = appendPoint(c, at(n, e));
  return finishAtLast(c);
}
function track(...wp: [number, number][]): Track {
  const pts = [pt(wp[0][0], wp[0][1], 0)];
  let t = 0;
  for (let k = 1; k < wp.length; k++) {
    const [n0, e0] = wp[k - 1];
    const [n1, e1] = wp[k];
    const steps = Math.max(1, Math.round(Math.hypot(n1 - n0, e1 - e0) / 3));
    for (let s = 1; s <= steps; s++) pts.push(pt(n0 + ((n1 - n0) * s) / steps, e0 + ((e1 - e0) * s) / steps, ++t));
  }
  return new Track('T', pts);
}
const FRAME = { width: 800, height: 450 };

function setup(wp: [number, number][], settings: Partial<CourseCameraSettings> = {}, speed = 1, northRotation = 0) {
  const tr = track(...wp);
  const c = course(...wp);
  const passings = matchCourse(tr, c);
  const cam = new CourseCamera({
    track: tr,
    crsCode: CRS,
    course: c,
    passings,
    settings: { ...DEFAULT_COURSE_CAMERA, approachEnabled: false, ...settings },
    speed,
    frame: FRAME,
    northRotation,
  });
  return { tr, c, passings, cam };
}
const screen = (view: ReturnType<CourseCamera['viewAt']>['view'], p: { lat: number; lon: number }) =>
  makeTransform(view, FRAME.width, FRAME.height, 1)(...forward(CRS, p));

describe('leg-oriented view (STORY-24)', () => {
  // S(0,0) → 1 (0,600) east → 2 (500,600) north → F (500,100) west
  const { cam, c, passings, tr } = setup([
    [0, 0],
    [0, 600],
    [500, 600],
    [500, 100],
  ]);

  it('rotates each leg so its target is straight above its start', () => {
    for (let li = 0; li < 3; li++) {
      const mid = (passings[li].t + passings[li + 1].t) / 2;
      const v = cam.viewAt(mid);
      expect(v.legIndex).toBe(li);
      const a = screen(v.view, c.points[li]);
      const b = screen(v.view, c.points[li + 1]);
      expect(Math.abs(a[0] - b[0])).toBeLessThan(0.5); // same column
      expect(b[1]).toBeLessThan(a[1]); // target above
    }
  });

  it('fits the whole leg route and both controls inside the frame with margins', () => {
    for (let li = 0; li < 3; li++) {
      const v = cam.viewAt((passings[li].t + passings[li + 1].t) / 2);
      for (let t = passings[li].t; t <= passings[li + 1].t; t += 5) {
        const [x, y] = screen(v.view, tr.positionAt(t));
        expect(x).toBeGreaterThan(20);
        expect(x).toBeLessThan(FRAME.width - 20);
        expect(y).toBeGreaterThan(20);
        expect(y).toBeLessThan(FRAME.height - 20);
      }
    }
  });

  it('is deterministic', () => {
    expect(cam.viewAt(123.4)).toEqual(cam.viewAt(123.4));
  });
});

describe('scale limits and panning (STORY-26)', () => {
  it('very short legs stop at the zoom-in limit', () => {
    const { cam } = setup(
      [
        [0, 0],
        [0, 20],
        [0, 40],
      ],
      { zoomInLimit: 4000 },
    );
    expect(cam.legs[0].resolution).toBeCloseTo(cam.legs[1].resolution, 9);
    expect(cam.legs[0].pans).toBe(false);
    // 1:4000 → 1.058 m per CSS px (× TM35 scale factor ≈ 0.9997)
    expect(cam.legs[0].resolution).toBeCloseTo(1.058, 2);
  });

  it('long legs stay at the zoom-out limit and pan with the runner inside the pan box', () => {
    const { cam, tr, passings } = setup(
      [
        [0, 0],
        [4000, 0],
        [4000, 200],
      ],
      { zoomOutLimit: 10000 },
    );
    const L = cam.legs[0];
    expect(L.pans).toBe(true);
    expect(L.resolution).toBeCloseTo(2.645, 2);
    for (let t = passings[0].t; t <= passings[1].t; t += 30) {
      const v = cam.viewAt(t);
      expect(v.view.resolution).toBeCloseTo(L.resolution, 6);
      const [x, y] = screen(v.view, tr.positionAt(t));
      // The camera follows the runner smoothed over ±8 s, so allow a few pixels of lag.
      expect(Math.abs(x - FRAME.width / 2)).toBeLessThanOrEqual(FRAME.width * 0.3 + 8);
      expect(Math.abs(y - FRAME.height / 2)).toBeLessThanOrEqual(FRAME.height * 0.3 + 8);
    }
  });
});

describe('transitions and approach zoom (STORY-25/27)', () => {
  const wp: [number, number][] = [
    [0, 0],
    [0, 500],
    [400, 500],
    [400, 0],
    [0, 0],
  ];

  it('changes smoothly between legs: no jumps at 60 fps', () => {
    const { cam, tr } = setup(wp, { approachEnabled: true });
    let prev = cam.viewAt(0).view;
    for (let t = 1 / 60; t <= tr.duration; t += 1 / 60) {
      const v = cam.viewAt(t).view;
      expect(Math.abs(lerpAngle(prev.rotation, v.rotation, 1) - prev.rotation)).toBeLessThan(0.05);
      expect(Math.abs(Math.log(v.resolution / prev.resolution))).toBeLessThan(0.05);
      expect(Math.hypot(v.center[0] - prev.center[0], v.center[1] - prev.center[1]) / v.resolution).toBeLessThan(25);
      prev = v;
    }
  });

  it('turns the short way round', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
  });

  it('time keeps running: transitions start after the passing and last the set duration (video s × speed)', () => {
    const { cam, passings } = setup(wp, { transitionDelay: 0.5, transitionDuration: 1.5 }, 2);
    expect(cam.tStart[1]).toBeCloseTo(passings[1].t + 1, 6);
    expect(cam.tEnd[1]).toBeCloseTo(passings[1].t + 4, 6);
  });

  it('approach zoom zooms in before the passing, within the zoom-in limit', () => {
    const { cam, passings } = setup(
      [
        [0, 0],
        [0, 900],
        [600, 900],
      ],
      { approachEnabled: true, approachScale: 5000, zoomOutLimit: 20000 },
    );
    const leg = cam.legs[0].resolution;
    const near = cam.viewAt(passings[1].t - 0.5).view.resolution;
    expect(near).toBeLessThan(leg * 0.9);
    expect(near).toBeGreaterThanOrEqual(cam.legs[0].resolution * 0 + 1.05);
  });
});

describe('Timeline course mode and route visibility (STORY-31)', () => {
  it('route alpha: fade in, hold, fade out, never past the leg end', () => {
    const r = { ...DEFAULT_ROUTE_DISPLAY, fadeIn: 1, hold: 2, fadeOut: 1 };
    expect(routeAlpha(9, 10, 100, r, 1)).toBe(0);
    expect(routeAlpha(10.5, 10, 100, r, 1)).toBeCloseTo(0.5, 6);
    expect(routeAlpha(12, 10, 100, r, 1)).toBe(1);
    expect(routeAlpha(13.5, 10, 100, r, 1)).toBeCloseTo(0.5, 6);
    expect(routeAlpha(15, 10, 100, r, 1)).toBe(0);
    expect(routeAlpha(13.5, 10, 13, r, 1)).toBe(0);
    expect(routeAlpha(50, 10, 100, { ...r, wholeLeg: true }, 1)).toBe(1);
  });

  it('frameStateAt reports the leg and uses the course camera', () => {
    const tr = track(...wp());
    const c = course(...wp());
    const passings = matchCourse(tr, c);
    const tl = new Timeline(tr, CRS, DEFAULT_FREE_MODE, {
      course: c,
      passings,
      camera: { ...DEFAULT_COURSE_CAMERA },
      routes: DEFAULT_ROUTE_DISPLAY,
      speed: 1,
    });
    const fs = tl.frameStateAt((passings[1].t + passings[2].t) / 2, FRAME);
    expect(fs.legIndex).toBe(1);
    expect(fs.legStartT).toBeCloseTo(passings[1].t, 6);
    expect(fs.routeAlpha).toBe(0); // well past fade-out of a 6 s display? depends on leg length
    function wp(): [number, number][] {
      return [
        [0, 0],
        [0, 500],
        [400, 500],
      ];
    }
  });
});

describe('overview after the finish uses map north', () => {
  const wp: [number, number][] = [
    [0, 0],
    [0, 600],
    [500, 600],
    [500, 100],
  ];
  it('rotation = map north and the whole course is in the frame', () => {
    const north = (-15 * Math.PI) / 180;
    const { cam, c, tr } = setup(wp, { afterFinish: 'overview' }, 1, north);
    const v = cam.viewAt(tr.duration + 60).view;
    expect(v.rotation).toBeCloseTo(north, 9);
    for (const p of c.points) {
      const [x, y] = screen(v, p);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(FRAME.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(FRAME.height);
    }
    // Without a raster map the overview stays grid-north-up.
    expect(setup(wp, { afterFinish: 'overview' }).cam.viewAt(tr.duration + 60).view.rotation).toBe(0);
  });
});

describe('route display time base and route-aware framing', () => {
  const r = { ...DEFAULT_ROUTE_DISPLAY, fadeIn: 1, hold: 2, fadeOut: 2 };

  it('real-time (1×) units ignore the playback speed', () => {
    // 10× video time: hold of 2 video s = 20 track s; real time: 2 track s.
    expect(routeAlpha(10 + 10 + 15, 10, 1000, r, 10)).toBe(1);
    expect(routeAlpha(10 + 1 + 2 + 1, 10, 1000, { ...r, timeBase: 'real' }, 10)).toBeCloseTo(0.5, 6);
    expect(routeAlpha(10 + 6, 10, 1000, { ...r, timeBase: 'real' }, 10)).toBe(0);
  });

  // Leg 1 east 600 m; a route choice that first runs 500 m back west (the fit is limited by the leg's length).
  const wp: [number, number][] = [
    [0, 0],
    [0, 600],
    [300, 600],
  ];
  function cam(routeDisplay?: typeof r) {
    const tr = track(...wp);
    const c = course(...wp);
    const passings = matchCourse(tr, c);
    const detour = [at(0, 0), at(-200, -500), at(0, 600)];
    return {
      passings,
      cam: new CourseCamera({
        track: tr,
        crsCode: CRS,
        course: c,
        passings,
        settings: { ...DEFAULT_COURSE_CAMERA, approachEnabled: false, zoomInLimit: 500 },
        speed: 1,
        frame: FRAME,
        legExtras: (li) => (li === 0 ? detour : []),
        routeDisplay,
      }),
    };
  }

  it('route choices are framed while shown, then the view zooms to the leg', () => {
    const { cam: c, passings } = cam({ ...r, hold: 20 });
    const t0 = passings[0].t;
    const shown = c.viewAt(t0 + 5).view; // routes visible
    const later = c.viewAt(t0 + 1 + 20 + 30).view; // faded out (fade 2 s, zoom over max(2, 1.5) s)
    expect(c.routeFraming(0, t0 + 5)).toBe(1);
    expect(c.routeFraming(0, t0 + 1 + 20 + 30)).toBe(0);
    expect(later.resolution).toBeLessThan(shown.resolution * 0.8);
    // While shown, the detour point is inside the frame.
    const [x, y] = screen(shown, at(-200, -500));
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(FRAME.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(FRAME.height);
  });

  it('without display settings or with "whole leg" the routes are always framed', () => {
    const { cam: a, passings } = cam();
    expect(a.routeFraming(0, passings[0].t + 60)).toBe(1);
    expect(cam({ ...r, wholeLeg: true }).cam.routeFraming(0, passings[0].t + 60)).toBe(1);
  });
});

describe('progressive leg zoom (STORY-42)', () => {
  // Leg 1: 800 m east with a 150 m detour north in the middle; leg 2: 400 m north.
  const wp: [number, number][] = [
    [0, 0],
    [0, 300],
    [150, 400],
    [0, 500],
    [0, 800],
    [400, 800],
  ];
  function make(settings: Partial<CourseCameraSettings>) {
    const tr = track(...wp);
    const c = course([0, 0], [0, 800], [400, 800]);
    const passings = matchCourse(tr, c);
    const cam = new CourseCamera({
      track: tr,
      crsCode: CRS,
      course: c,
      passings,
      settings: {
        ...DEFAULT_COURSE_CAMERA,
        approachEnabled: true,
        zoomInLimit: 1000,
        zoomOutLimit: 20000,
        ...settings,
      },
      speed: 1,
      frame: FRAME,
    });
    return { tr, c, passings, cam };
  }
  const inside = (xy: number[], pad = 1) =>
    xy[0] >= -pad && xy[0] <= FRAME.width + pad && xy[1] >= -pad && xy[1] <= FRAME.height + pad;

  it('frames the remaining route, the target and the runner; zooms in only', () => {
    const { tr, c, passings, cam } = make({ legZoom: 'target', legZoomStopScale: 2000 });
    const t0 = passings[0].t;
    const t1 = passings[1].t;
    let prev = Infinity;
    for (let t = t0; t <= t1; t += (t1 - t0) / 40) {
      const v = cam.viewAt(t).view;
      expect(v.resolution).toBeLessThanOrEqual(prev * (1 + 1e-9));
      prev = v.resolution;
      expect(inside(screen(v, c.points[1]))).toBe(true);
      expect(inside(screen(v, tr.positionAt(t)))).toBe(true);
      for (let u = t; u <= t1; u += 2) expect(inside(screen(v, tr.positionAt(u)))).toBe(true);
    }
    // Near the target it is much closer than the whole-leg fit, but not past the stop scale.
    const end = cam.viewAt(t1 - 1).view.resolution;
    expect(end).toBeLessThan(cam.coreLegs[0].resolution * 0.5);
    expect(end).toBeGreaterThanOrEqual(groundResolutionForScale(2000) * pointScale(CRS, tr.center()) * 0.999);
  });

  it('is a pure function of t and replaces the approach zoom', () => {
    const a = make({ legZoom: 'target' });
    const b = make({ legZoom: 'target' });
    const t = (a.passings[0].t + a.passings[1].t) / 2;
    b.cam.viewAt(a.passings[1].t); // different call order
    expect(b.cam.viewAt(t)).toEqual(a.cam.viewAt(t));
    const near = a.passings[1].t - 2;
    const whole = make({ legZoom: 'whole', approachEnabled: false });
    expect(a.cam.viewAt(near).view.resolution).toBeLessThan(whole.cam.viewAt(near).view.resolution);
  });

  it('start distance: whole-leg framing until the remaining route is shorter', () => {
    const { tr, passings, cam } = make({ legZoom: 'target', legZoomStartDistance: 300, approachEnabled: false });
    const whole = make({ legZoom: 'whole', approachEnabled: false }).cam;
    const dEnd = tr.positionAt(passings[1].t).d;
    const early = tr.positionAtDistance(dEnd - 700).t;
    expect(cam.viewAt(early).view.resolution).toBeCloseTo(whole.viewAt(early).view.resolution, 6);
    const late = tr.positionAtDistance(dEnd - 50).t;
    expect(cam.viewAt(late).view.resolution).toBeLessThan(whole.viewAt(late).view.resolution * 0.7);
  });

  it('zooms steadily over the whole leg and reaches the stop scale only at the target', () => {
    // Short leg 2 (400 m): the remaining route fits at the stop scale early in the leg. The scale must still keep
    // changing until the target instead of reaching the stop at once and then only panning.
    const { tr, passings, cam } = make({ legZoom: 'target', approachEnabled: false, legZoomStopScale: 2000 });
    const dA = tr.positionAt(passings[1].t).d;
    const dB = tr.positionAt(passings[2].t).d;
    const at = (f: number) => cam.legView(1, tr.positionAtDistance(dA + (dB - dA) * f).t).resolution;
    const stop = groundResolutionForScale(2000) * pointScale(CRS, tr.center());
    const r = [0.1, 0.3, 0.5, 0.7, 0.9].map(at);
    for (let k = 1; k < r.length; k++) expect(r[k]).toBeLessThan(r[k - 1] * 0.97);
    expect(r[2]).toBeGreaterThan(stop * 1.3); // halfway: not yet at the stop scale
    expect(at(1)).toBeLessThan(stop * 1.15);
  });

  it('"whole leg" keeps the previous behaviour', () => {
    const { passings, cam } = make({ legZoom: 'whole', approachEnabled: false });
    const t = (passings[0].t + passings[1].t) / 2;
    expect(cam.viewAt(t).view.resolution).toBeCloseTo(cam.legs[0].resolution, 9);
  });
});
