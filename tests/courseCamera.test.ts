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
import { forward } from '../src/lib/geo/crs';
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

function setup(wp: [number, number][], settings: Partial<CourseCameraSettings> = {}, speed = 1) {
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
