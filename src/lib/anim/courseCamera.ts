/**
 * Course-mode camera (EPIC-4, EN-14): a PURE function of track time.
 *
 * - Leg view (STORY-24): for leg i (point i → i+1, active between their passing times) the map is rotated so the
 *   grid bearing from the leg start to the leg target points up, and fitted to the leg's GPX segment, both leg
 *   points and the leg's route choices, with margins.
 * - Scale limits (STORY-26): the fit is clamped to [zoom-in limit, zoom-out limit]. If the leg does not fit at the
 *   zoom-out limit, the camera pans with the (time-smoothed) runner inside the leg's bounding box.
 * - Transitions (STORY-25): rotation (short way), log-resolution and centre are eased from the previous leg's view
 *   to the next one; time keeps running.
 * - Approach zoom (STORY-27): before a passing the view zooms towards the target control and the runner.
 *
 * All durations given in VIDEO seconds are converted to track seconds with `speed`.
 */
import { forward } from '../geo/crs';
import { groundResolutionForScale, type LatLon } from '../geo/geo';
import { pointScale } from '../geo/crs';
import type { Course } from '../course/course';
import type { Passing } from '../course/match';
import type { Track } from '../track/track';
import type { ViewState } from './timeline';

export type Easing = 'cubic' | 'sine' | 'linear';

export interface CourseCameraSettings {
  /** Largest scale (most detail), e.g. 4000 for 1:4 000. */
  zoomInLimit: number;
  /** Smallest scale (least detail), e.g. 15000 for 1:15 000. */
  zoomOutLimit: number;
  /** Margin around the leg content: fixed CSS px (symbols) + fraction of the frame's short side. */
  marginPx: number;
  marginFraction: number;
  /** Transition start relative to the passing (video s; may be negative) and its length (video s). */
  transitionDelay: number;
  transitionDuration: number;
  easing: Easing;
  approachEnabled: boolean;
  /** Approach zoom starts this many TRACK seconds before the passing. */
  approachSeconds: number;
  approachScale: number;
  /** Length of the zoom-in itself (video s). */
  approachDuration: number;
  /** Runner kept inside this central fraction of the frame while panning. */
  panBox: number;
  /** View after the finish: keep the last leg or show the whole course. */
  afterFinish: 'hold' | 'overview';
}

export const DEFAULT_COURSE_CAMERA: CourseCameraSettings = {
  zoomInLimit: 4000,
  zoomOutLimit: 15000,
  marginPx: 22,
  marginFraction: 0.06,
  transitionDelay: 0.5,
  transitionDuration: 1.5,
  easing: 'sine',
  approachEnabled: true,
  approachSeconds: 10,
  approachScale: 5000,
  approachDuration: 2,
  panBox: 0.6,
  afterFinish: 'hold',
};

export const EASINGS: Record<Easing, (x: number) => number> = {
  linear: (x) => x,
  sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
  cubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Shortest-way angle interpolation (radians). */
export function lerpAngle(a: number, b: number, f: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * f;
}

interface Box {
  rmin: number;
  rmax: number;
  fmin: number;
  fmax: number;
}

export interface LegPlan {
  index: number;
  /** Passing times (track s) of the leg's start and target point. */
  t0: number;
  t1: number;
  /** Grid bearing (deg) of the leg direction; view rotation = −bearing. */
  bearing: number;
  rotation: number;
  /** Content box in leg coordinates (r = right, f = forward), metres in the view CRS. */
  box: Box;
  /** Fitted (and clamped) resolution and centre. */
  resolution: number;
  center: [number, number];
  /** True when the content does not fit at the zoom-out limit → the camera pans. */
  pans: boolean;
  target: [number, number];
}

export interface CourseCameraInput {
  track: Track;
  crsCode: string;
  course: Course;
  passings: Passing[];
  settings: CourseCameraSettings;
  /** Playback/export speed (track seconds per video second). */
  speed: number;
  /** Frame size in CSS px. */
  frame: { width: number; height: number };
  /** Extra points to keep in view per leg (route choices), by leg index. */
  legExtras?: (legIndex: number) => LatLon[];
}

export interface CameraState {
  view: ViewState;
  /** Leg shown (during a transition: the leg being entered). */
  legIndex: number;
  /** Track time at which leg `legIndex` became the shown leg (start of its transition). */
  legShownAt: number;
  /** Track time at which the transition into the leg ends. */
  legSettledAt: number;
  /** Track time at which the transition out of the leg starts (Infinity for the last leg). */
  legEndsAt: number;
}

export class CourseCamera {
  readonly legs: LegPlan[];
  /** Transition start/end (track s) INTO leg i (index 0: −Infinity). */
  readonly tStart: number[];
  readonly tEnd: number[];
  private readonly resMin: number;
  private readonly resMax: number;
  private readonly rot2: (xy: [number, number], rot: number, origin: [number, number]) => [number, number];
  private readonly overview: { center: [number, number]; resolution: number } | null;

  constructor(private readonly i: CourseCameraInput) {
    const { track, crsCode, course, passings, settings, speed, frame } = i;
    const k = pointScale(crsCode, track.center());
    this.resMin = groundResolutionForScale(settings.zoomInLimit) * k;
    this.resMax = groundResolutionForScale(Math.max(settings.zoomOutLimit, settings.zoomInLimit)) * k;
    this.rot2 = (xy, rot, o) => {
      // Coordinates relative to o in the leg frame: r (right), f (forward).
      const dx = xy[0] - o[0];
      const dy = xy[1] - o[1];
      const b = -rot; // bearing in radians
      return [dx * Math.cos(b) - dy * Math.sin(b), dx * Math.sin(b) + dy * Math.cos(b)];
    };

    const pts = course.points.map((p) => forward(crsCode, p));
    this.legs = [];
    for (let li = 0; li + 1 < pts.length; li++) {
      this.legs.push(this.planLeg(li, pts[li], pts[li + 1], passings[li].t, passings[li + 1].t));
    }

    // Transition schedule (in track seconds).
    const n = this.legs.length;
    const D = settings.transitionDuration * speed;
    const delay = settings.transitionDelay * speed;
    this.tStart = new Array(n).fill(-Infinity);
    this.tEnd = new Array(n).fill(-Infinity);
    for (let li = 1; li < n; li++) {
      const s = Math.max(passings[li].t + delay, this.tEnd[li - 1]);
      this.tStart[li] = s;
      this.tEnd[li] = s + D;
    }
    // Shorten transitions that would overlap the next one.
    for (let li = 1; li + 1 < n; li++) {
      if (this.tEnd[li] > this.tStart[li + 1]) this.tEnd[li] = Math.max(this.tStart[li], this.tStart[li + 1]);
    }

    this.overview = settings.afterFinish === 'overview' ? this.planOverview(pts) : null;
    void frame;
  }

  private margins(): { mx: number; my: number } {
    const { frame, settings } = this.i;
    const m = settings.marginPx + settings.marginFraction * Math.min(frame.width, frame.height);
    return { mx: m, my: m };
  }

  private planLeg(index: number, a: [number, number], b: [number, number], t0: number, t1: number): LegPlan {
    const { track, crsCode, frame, legExtras } = this.i;
    const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
    const rotation = -(bearing * Math.PI) / 180;
    const content: [number, number][] = [a, b];
    // GPX segment of the leg (sampled about once per second of track).
    const step = Math.max(1, (t1 - t0) / 600);
    for (let t = t0; t <= t1; t += step) content.push(forward(crsCode, track.positionAt(t)));
    for (const p of legExtras?.(index) ?? []) content.push(forward(crsCode, p));
    const rf = content.map((p) => this.rot2(p, rotation, a));
    const box: Box = {
      rmin: Math.min(...rf.map((p) => p[0])),
      rmax: Math.max(...rf.map((p) => p[0])),
      fmin: Math.min(...rf.map((p) => p[1])),
      fmax: Math.max(...rf.map((p) => p[1])),
    };
    const { mx, my } = this.margins();
    const w = Math.max(20, frame.width - 2 * mx);
    const h = Math.max(20, frame.height - 2 * my);
    const fit = Math.max((box.rmax - box.rmin) / w, (box.fmax - box.fmin) / h, 1e-9);
    const resolution = Math.min(this.resMax, Math.max(this.resMin, fit));
    const pans = fit > this.resMax * 1.0001;
    const center = this.fromLeg([(box.rmin + box.rmax) / 2, (box.fmin + box.fmax) / 2], rotation, a);
    return { index, t0, t1, bearing, rotation, box, resolution, center, pans, target: b };
  }

  private planOverview(pts: [number, number][]) {
    const { frame, track, crsCode } = this.i;
    const all = [...pts];
    for (let k = 0; k < track.points.length; k += Math.max(1, Math.floor(track.points.length / 500))) {
      all.push(forward(crsCode, track.points[k]));
    }
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const { mx, my } = this.margins();
    const res = Math.max(
      (Math.max(...xs) - Math.min(...xs)) / Math.max(20, frame.width - 2 * mx),
      (Math.max(...ys) - Math.min(...ys)) / Math.max(20, frame.height - 2 * my),
    );
    return {
      center: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2] as [number, number],
      resolution: Math.max(this.resMin, res),
    };
  }

  /** Leg coordinates (r, f) relative to `origin` → view CRS. */
  private fromLeg(rf: [number, number], rotation: number, origin: [number, number]): [number, number] {
    const b = -rotation;
    return [
      origin[0] + rf[0] * Math.cos(b) + rf[1] * Math.sin(b),
      origin[1] - rf[0] * Math.sin(b) + rf[1] * Math.cos(b),
    ];
  }

  /** Runner position averaged over ±w track seconds (smooth, pure). */
  private smoothRunner(t: number, w = 8): [number, number] {
    const { track, crsCode } = this.i;
    let x = 0;
    let y = 0;
    const n = 9;
    for (let k = 0; k < n; k++) {
      const p = forward(crsCode, track.positionAt(t - w + (2 * w * k) / (n - 1)));
      x += p[0];
      y += p[1];
    }
    return [x / n, y / n];
  }

  /** The leg's own view at time t (pan + approach zoom), without transitions. */
  legView(li: number, t: number): ViewState {
    const L = this.legs[li];
    const { settings, frame, speed, course, crsCode } = this.i;
    let center = L.center;
    let res = L.resolution;
    const origin = forward(crsCode, course.points[li]);

    if (L.pans) {
      // Keep the smoothed runner inside the central pan box, the view inside the leg box.
      const hw = (frame.width * res) / 2;
      const hh = (frame.height * res) / 2;
      const [rr, rf] = this.rot2(this.smoothRunner(t), L.rotation, origin);
      const cr0 = (L.box.rmin + L.box.rmax) / 2;
      const cf0 = (L.box.fmin + L.box.fmax) / 2;
      // Desired centre: a bit ahead of the runner (towards the target).
      let cr = rr;
      let cf = rf + hh * 0.25;
      const clampAxis = (c: number, lo: number, hi: number, half: number, mid: number) =>
        hi - lo <= 2 * half ? mid : Math.min(hi - half, Math.max(lo + half, c));
      cr = clampAxis(cr, L.box.rmin, L.box.rmax, hw, cr0);
      cf = clampAxis(cf, L.box.fmin, L.box.fmax, hh, cf0);
      // Runner must stay inside the pan box.
      const bw = hw * settings.panBox;
      const bh = hh * settings.panBox;
      cr = Math.min(rr + bw, Math.max(rr - bw, cr));
      cf = Math.min(rf + bh, Math.max(rf - bh, cf));
      center = this.fromLeg([cr, cf], L.rotation, origin);
    }

    // Approach zoom towards the target control.
    if (settings.approachEnabled) {
      const a0 = Math.max(L.t1 - settings.approachSeconds, this.tEnd[li] ?? -Infinity, L.t0);
      const dur = Math.max(1e-6, settings.approachDuration * speed);
      if (L.t1 - a0 > settings.approachSeconds * 0.4 && t > a0) {
        const e = EASINGS[settings.easing](clamp01((t - a0) / dur));
        const k = pointScale(crsCode, this.i.track.center());
        const target = Math.min(res, Math.max(this.resMin, groundResolutionForScale(settings.approachScale) * k));
        const runner = this.smoothRunner(Math.min(t, L.t1), 3);
        const c: [number, number] = [
          L.target[0] + 0.35 * (runner[0] - L.target[0]),
          L.target[1] + 0.35 * (runner[1] - L.target[1]),
        ];
        res = Math.exp(lerp(Math.log(res), Math.log(target), e));
        center = [lerp(center[0], c[0], e), lerp(center[1], c[1], e)];
      }
    }
    return { center, resolution: res, rotation: L.rotation };
  }

  private blend(A: ViewState, B: ViewState, x: number): ViewState {
    const e = EASINGS[this.i.settings.easing](clamp01(x));
    // Zoom out a little in the middle when the views are far apart, so the move stays readable.
    const dist = Math.hypot(B.center[0] - A.center[0], B.center[1] - A.center[1]);
    const span = Math.max(A.resolution, B.resolution) * Math.hypot(this.i.frame.width, this.i.frame.height);
    const bump = 1 + Math.min(0.6, dist / Math.max(span, 1e-9)) * Math.sin(Math.PI * e);
    const res = Math.min(this.resMax * 1.6, Math.exp(lerp(Math.log(A.resolution), Math.log(B.resolution), e)) * bump);
    return {
      center: [lerp(A.center[0], B.center[0], e), lerp(A.center[1], B.center[1], e)],
      resolution: res,
      rotation: lerpAngle(A.rotation, B.rotation, e),
    };
  }

  viewAt(t: number): CameraState {
    const n = this.legs.length;
    // Active leg: the last one whose transition has started.
    let li = 0;
    while (li + 1 < n && t >= this.tStart[li + 1]) li++;
    const state = (view: ViewState): CameraState => ({
      view,
      legIndex: li,
      legShownAt: li === 0 ? -Infinity : this.tStart[li],
      legSettledAt: li === 0 ? -Infinity : this.tEnd[li],
      legEndsAt: li + 1 < n ? this.tStart[li + 1] : Infinity,
    });
    if (li > 0 && t < this.tEnd[li]) {
      const A = this.legView(li - 1, Math.min(t, this.tStart[li]));
      const B = this.legView(li, this.tEnd[li]);
      return state(this.blend(A, B, (t - this.tStart[li]) / Math.max(1e-6, this.tEnd[li] - this.tStart[li])));
    }
    const last = this.legs[n - 1];
    if (this.overview && li === n - 1 && t > last.t1) {
      const s = last.t1 + this.i.settings.transitionDelay * this.i.speed;
      const D = this.i.settings.transitionDuration * this.i.speed;
      const A = this.legView(li, last.t1);
      const B: ViewState = { ...this.overview, rotation: 0 };
      return state(t <= s ? A : this.blend(A, B, (t - s) / Math.max(1e-6, D)));
    }
    return state(this.legView(li, Math.min(t, li === n - 1 ? last.t1 : t)));
  }
}
