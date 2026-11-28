/**
 * Course-mode camera (EPIC-4, EN-14): a PURE function of track time.
 *
 * - Leg view (STORY-24): for leg i (point i → i+1, active between their passing times) the map is rotated so the
 *   grid bearing from the leg start to the leg target points up, and fitted to the leg's GPX segment, both leg
 *   points and the leg's route choices, with margins.
 * - Scale limits (STORY-26): the fit is clamped to [zoom-in limit, zoom-out limit]. If the leg does not fit at the
 *   zoom-out limit, the camera pans with the (time-smoothed) runner inside the leg's bounding box.
 * - Transitions (STORY-25): rotation (short way), log-resolution and centre are eased from the previous leg's view
 *   to the next one; time keeps running. With an instant leg change (STORY-45) the view cuts in one frame.
 * - Real-time transition clips (STORY-46): `transitionOverride` animates the leg changes over a different (track-time)
 *   duration while everything else – the schedule, route display, approach zoom – stays as in the main video.
 * - Approach zoom (STORY-27): before a passing the view zooms towards the target control and the runner.
 * - Progressive leg zoom (STORY-42, optional): the leg view is fitted to the route still to run (runner → target
 *   passing, as actually run) plus the target, zooming in continuously and never out; replaces the approach zoom.
 *
 * Durations in the settings are in the project's time base (STORY-47) and converted to track seconds with
 * `timeScale` (track s per settings second); internal smoothing constants are video seconds (× `speed`).
 */
import { forward } from '../geo/crs';
import { groundResolutionForScale, type LatLon } from '../geo/geo';
import { pointScale } from '../geo/crs';
import type { Course } from '../course/course';
import type { Passing } from '../course/match';
import type { Track } from '../track/track';
import type { RouteDisplaySettings, ViewState } from './timeline';

/**
 * Route-choice opacity: fade in at `start`, hold, fade out; never past the end of the leg.
 * `timeScale`: track seconds per settings second (STORY-47).
 */
export function routeAlpha(
  t: number,
  start: number,
  legEnd: number,
  r: RouteDisplaySettings,
  timeScale: number,
): number {
  if (!Number.isFinite(start) || t < start || t >= legEnd) return 0;
  const k = timeScale;
  const fi = Math.max(1e-6, r.fadeIn * k);
  const x = t - start;
  if (x < fi) return x / fi;
  if (r.wholeLeg) return 1;
  const hold = r.hold * k;
  if (x < fi + hold) return 1;
  const fo = Math.max(1e-6, r.fadeOut * k);
  return Math.max(0, 1 - (x - fi - hold) / fo);
}

export type Easing = 'cubic' | 'sine' | 'linear';

export interface CourseCameraSettings {
  /** Largest scale (most detail), e.g. 4000 for 1:4 000. */
  zoomInLimit: number;
  /** Smallest scale (least detail), e.g. 15000 for 1:15 000. */
  zoomOutLimit: number;
  /** Margin around the leg content: fixed CSS px (symbols) + fraction of the frame's short side. */
  marginPx: number;
  marginFraction: number;
  /** Leg change: animated transition (STORY-25) or an instant cut (STORY-45). */
  legChange: 'animated' | 'instant';
  /** Transition start (or cut) relative to the passing (s; may be negative) and its length (s). */
  transitionDelay: number;
  transitionDuration: number;
  easing: Easing;
  approachEnabled: boolean;
  /** Approach zoom starts this many seconds before the passing. */
  approachSeconds: number;
  approachScale: number;
  /** Length of the zoom-in itself (s). */
  approachDuration: number;
  /** Runner kept inside this central fraction of the frame while panning. */
  panBox: number;
  /** View after the finish: keep the last leg or show the whole course. */
  afterFinish: 'hold' | 'overview';
  /** Leg framing: the whole leg, or zoom in towards the target with the remaining route (STORY-42). */
  legZoom: 'whole' | 'target';
  /** Progressive zoom stops at this scale (or the zoom-in limit, if that is larger). */
  legZoomStopScale: number;
  /** Progressive zoom starts when the remaining route is shorter than this (m); 0 = from the leg start. */
  legZoomStartDistance: number;
}

export const DEFAULT_COURSE_CAMERA: CourseCameraSettings = {
  zoomInLimit: 4000,
  zoomOutLimit: 15000,
  marginPx: 22,
  marginFraction: 0.06,
  legChange: 'animated',
  transitionDelay: 0.5,
  transitionDuration: 1.5,
  easing: 'sine',
  approachEnabled: true,
  approachSeconds: 10,
  approachScale: 5000,
  approachDuration: 2,
  panBox: 0.6,
  afterFinish: 'hold',
  legZoom: 'whole',
  legZoomStopScale: 5000,
  legZoomStartDistance: 0,
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

/** Precomputed progressive-zoom framing of one leg, sampled in track time (see `zoomSeries`). */
interface ZoomSeries {
  t0: number;
  step: number;
  /** Resolution, centre in leg coordinates (r, f), and whether the remaining route needs panning. */
  res: Float64Array;
  cr: Float64Array;
  cf: Float64Array;
  pans: Uint8Array;
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
  /** Track seconds per settings second (STORY-47 time base); defaults to `speed` (video seconds). */
  timeScale?: number;
  /** Frame size in CSS px. */
  frame: { width: number; height: number };
  /** Extra points to keep in view per leg (route choices), by leg index. */
  legExtras?: (legIndex: number) => LatLon[];
  /** "North-up" rotation for the overview (orienteering map north with a raster map), OL radians. */
  northRotation?: number;
  /**
   * When route choices are shown. With it, the leg framing includes the route choices only while they are shown
   * and zooms to the leg itself (GPX, start, target) as they fade out; without it they are always included.
   */
  routeDisplay?: RouteDisplaySettings;
  /**
   * Real-time transition clips (STORY-46): animate each leg change (and the overview after the finish) over this
   * many TRACK seconds instead. The schedule (start times, settled times) is unchanged, so the frames outside the
   * animation equal the main video's frames.
   */
  transitionOverride?: number;
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
  /** Leg plans including the route choices. */
  readonly legs: LegPlan[];
  /** Leg plans without route choices (GPX segment and the two leg points only). */
  readonly coreLegs: LegPlan[];
  /** Transition start/end (track s) INTO leg i (index 0: −Infinity). */
  readonly tStart: number[];
  readonly tEnd: number[];
  /** End (track s) of the camera animation into leg i: `tEnd`, or shorter/longer with `transitionOverride`. */
  readonly tBlendEnd: number[];
  /** Transition length in track seconds as scheduled (0 for an instant leg change). */
  readonly transitionTrack: number;
  /** Track seconds per settings second. */
  readonly timeScale: number;
  private readonly resMin: number;
  private readonly resMax: number;
  private readonly rot2: (xy: [number, number], rot: number, origin: [number, number]) => [number, number];
  private readonly overview: ViewState | null;

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
    this.coreLegs = [];
    for (let li = 0; li + 1 < pts.length; li++) {
      const extras = i.legExtras?.(li) ?? [];
      const full = this.planLeg(li, pts[li], pts[li + 1], passings[li].t, passings[li + 1].t, extras);
      this.legs.push(full);
      this.coreLegs.push(
        extras.length ? this.planLeg(li, pts[li], pts[li + 1], passings[li].t, passings[li + 1].t, []) : full,
      );
    }

    // Transition schedule (in track seconds).
    const n = this.legs.length;
    const ts = i.timeScale ?? speed;
    this.timeScale = ts;
    const D = settings.legChange === 'instant' ? 0 : settings.transitionDuration * ts;
    this.transitionTrack = D;
    const delay = settings.transitionDelay * ts;
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
    const ov = i.transitionOverride;
    this.tBlendEnd = this.tEnd.map((e, li) =>
      ov === undefined || li === 0 ? e : Math.min(this.tStart[li] + Math.max(0, ov), this.tStart[li + 1] ?? Infinity),
    );

    this.overview = settings.afterFinish === 'overview' ? this.planOverview(pts) : null;
    void frame;
  }

  /**
   * The camera moves between views (STORY-46 clips): for each leg change and the overview after the finish, its
   * start, the end of the scheduled move and the end of the actual (possibly overridden) animation, in track s.
   */
  moves(): { legIndex: number; start: number; end: number; animEnd: number }[] {
    const out = [];
    for (let li = 1; li < this.legs.length; li++)
      out.push({ legIndex: li, start: this.tStart[li], end: this.tEnd[li], animEnd: this.tBlendEnd[li] });
    if (this.overview) {
      const s = this.legs[this.legs.length - 1].t1 + this.i.settings.transitionDelay * this.timeScale;
      out.push({
        legIndex: this.legs.length,
        start: s,
        end: s + this.transitionTrack,
        animEnd: s + (this.i.transitionOverride ?? this.transitionTrack),
      });
    }
    return out;
  }

  private margins(): { mx: number; my: number } {
    const { frame, settings } = this.i;
    const m = settings.marginPx + settings.marginFraction * Math.min(frame.width, frame.height);
    return { mx: m, my: m };
  }

  private planLeg(
    index: number,
    a: [number, number],
    b: [number, number],
    t0: number,
    t1: number,
    extras: LatLon[],
  ): LegPlan {
    const { track, crsCode, frame } = this.i;
    const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
    const rotation = -(bearing * Math.PI) / 180;
    const content: [number, number][] = [a, b];
    // GPX segment of the leg (sampled about once per second of track).
    const step = Math.max(1, (t1 - t0) / 600);
    for (let t = t0; t <= t1; t += step) content.push(forward(crsCode, track.positionAt(t)));
    for (const p of extras) content.push(forward(crsCode, p));
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
    // Fit in the "north-up" frame (map north with a raster map).
    const rotation = this.i.northRotation ?? 0;
    const o = all[0];
    const rf = all.map((p) => this.rot2(p, rotation, o));
    const rs = rf.map((p) => p[0]);
    const fs = rf.map((p) => p[1]);
    const { mx, my } = this.margins();
    const res = Math.max(
      (Math.max(...rs) - Math.min(...rs)) / Math.max(20, frame.width - 2 * mx),
      (Math.max(...fs) - Math.min(...fs)) / Math.max(20, frame.height - 2 * my),
    );
    const mid: [number, number] = [(Math.max(...rs) + Math.min(...rs)) / 2, (Math.max(...fs) + Math.min(...fs)) / 2];
    return { center: this.fromLeg(mid, rotation, o), resolution: Math.max(this.resMin, res), rotation };
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

  /** When leg li's route choices appear (track s), as in the video (STORY-31). */
  routeShownAt(li: number): number {
    if (li === 0) return this.i.passings[0].t;
    return this.i.routeDisplay?.appear === 'transition' ? this.tStart[li] : this.tEnd[li];
  }

  /**
   * Weight (0..1) of the route choices in leg li's framing at t: 1 while they are shown, easing to 0 as they fade
   * out (over the fade-out or the transition duration, whichever is longer), 0 afterwards.
   */
  routeFraming(li: number, t: number): number {
    const r = this.i.routeDisplay;
    if (this.legs[li] === this.coreLegs[li]) return 0; // no route choices on this leg
    if (!r || r.wholeLeg) return 1;
    const k = this.timeScale;
    const foStart = this.routeShownAt(li) + (r.fadeIn + r.hold) * k;
    if (t <= foStart) return 1;
    const z = Math.max(r.fadeOut * k, this.transitionTrack, 1e-6);
    return 1 - EASINGS[this.i.settings.easing](clamp01((t - foStart) / z));
  }

  /** The leg's own view at time t (route framing + pan + approach zoom), without transitions. */
  legView(li: number, t: number): ViewState {
    const L = this.legs[li];
    const { settings } = this.i;
    const ts = this.timeScale;
    const w = this.routeFraming(li, t);
    const progressive = settings.legZoom === 'target';
    const coreView = () => (progressive ? this.progressiveView(li, t) : this.panView(this.coreLegs[li], li, t));
    let { center, res } = w > 0 ? this.panView(L, li, t) : coreView();
    if (w > 0 && w < 1) {
      const core = coreView();
      res = Math.exp(lerp(Math.log(core.res), Math.log(res), w));
      center = [lerp(core.center[0], center[0], w), lerp(core.center[1], center[1], w)];
    }
    const { crsCode } = this.i;

    // Approach zoom towards the target control (not with the progressive zoom: they would fight).
    if (settings.approachEnabled && !progressive) {
      const before = settings.approachSeconds * ts;
      const a0 = Math.max(L.t1 - before, this.tEnd[li] ?? -Infinity, L.t0);
      const dur = Math.max(1e-6, settings.approachDuration * ts);
      if (L.t1 - a0 > before * 0.4 && t > a0) {
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

  private zoomCache = new Map<number, ZoomSeries>();

  /**
   * Progressive leg zoom at t: the leg view fitted to the remaining route (STORY-42), from a precomputed series.
   * Where even the remaining route does not fit at the zoom-out limit, the normal panning view is used.
   */
  private progressiveView(li: number, t: number): { center: [number, number]; res: number } {
    let z = this.zoomCache.get(li);
    if (!z) this.zoomCache.set(li, (z = this.zoomSeries(li)));
    const n = z.res.length;
    const x = Math.min(n - 1, Math.max(0, (t - z.t0) / z.step));
    const i = Math.min(Math.floor(x), n - 2);
    const f = Math.min(1, x - i);
    if (z.pans[i] || z.pans[i + 1]) return this.panView(this.coreLegs[li], li, t);
    const L = this.legs[li];
    const origin = forward(this.i.crsCode, this.i.course.points[li]);
    const rf: [number, number] = [lerp(z.cr[i], z.cr[i + 1], f), lerp(z.cf[i], z.cf[i + 1], f)];
    return {
      center: this.fromLeg(rf, L.rotation, origin),
      res: Math.exp(lerp(Math.log(z.res[i]), Math.log(z.res[i + 1]), f)),
    };
  }

  /**
   * Framing of leg li over its duration. For each sample time τ the content is the runner at τ, the GPX from τ to
   * the target passing and the target point (leg coordinates). The resolution is the suffix maximum of the fits
   * (so it only decreases: zoom in, never out), clamped to [stop scale, whole-leg fit], then smoothed with a
   * forward exponential filter (stays ≥ the fit, so the content still fits). The centre is smoothed the same way
   * and clamped so the content box stays inside the frame.
   */
  private zoomSeries(li: number): ZoomSeries {
    const L = this.coreLegs[li];
    const { track, crsCode, frame, settings, speed, course } = this.i;
    const origin = forward(crsCode, course.points[li]);
    const target = this.rot2(forward(crsCode, course.points[li + 1]), L.rotation, origin);
    const t0 = L.t0;
    const n = Math.max(2, Math.min(600, Math.ceil(Math.max(0, L.t1 - t0) / 0.25) + 1));
    const step = Math.max(1e-6, (L.t1 - t0) / (n - 1));
    const pr = new Float64Array(n);
    const pf = new Float64Array(n);
    const dist = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const p = track.positionAt(t0 + k * step);
      const q = this.rot2(forward(crsCode, p), L.rotation, origin);
      pr[k] = q[0];
      pf[k] = q[1];
      dist[k] = p.d;
    }
    // Suffix boxes of the remaining route, including the target.
    const rmin = new Float64Array(n);
    const rmax = new Float64Array(n);
    const fmin = new Float64Array(n);
    const fmax = new Float64Array(n);
    for (let k = n - 1; k >= 0; k--) {
      const nx = k + 1 < n;
      rmin[k] = Math.min(pr[k], nx ? rmin[k + 1] : target[0]);
      rmax[k] = Math.max(pr[k], nx ? rmax[k + 1] : target[0]);
      fmin[k] = Math.min(pf[k], nx ? fmin[k + 1] : target[1]);
      fmax[k] = Math.max(pf[k], nx ? fmax[k + 1] : target[1]);
    }
    const { mx, my } = this.margins();
    const w = Math.max(20, frame.width - 2 * mx);
    const h = Math.max(20, frame.height - 2 * my);
    const kScale = pointScale(crsCode, track.center());
    const stopRes = Math.max(this.resMin, groundResolutionForScale(settings.legZoomStopScale) * kScale);
    const whole = L.resolution;
    const wholeC = this.rot2(L.center, L.rotation, origin);
    const dEnd = track.positionAt(L.t1).d;
    const startD = settings.legZoomStartDistance;

    const res = new Float64Array(n);
    const pans = new Uint8Array(n);
    const raw = new Float64Array(n);
    // The zoom follows the remaining distance: from the whole-leg scale where the zoom starts to the stop scale
    // at the target (log-linear, i.e. a steady zoom rate per metre), never tighter than the remaining route needs.
    // (Fitting the remaining route alone reaches the stop scale early in the leg, and the rest of it only pans.)
    let kStart = 0;
    while (kStart < n - 1 && startD > 0 && dEnd - dist[kStart] > startD) kStart++;
    const remaining0 = Math.max(1e-6, dEnd - dist[kStart]);
    const stop = Math.min(whole, stopRes);
    for (let k = 0; k < n; k++) {
      const fit = Math.max((rmax[k] - rmin[k]) / w, (fmax[k] - fmin[k]) / h, 1e-9);
      const p = k < kStart ? 0 : clamp01(1 - (dEnd - dist[k]) / remaining0);
      const profile = Math.exp(lerp(Math.log(whole), Math.log(stop), p));
      raw[k] = Math.min(whole, Math.max(profile, fit));
      pans[k] = fit > this.resMax * 1.0001 ? 1 : 0;
    }
    // Zoom in only: suffix maximum.
    for (let k = n - 1; k >= 0; k--) res[k] = k + 1 < n ? Math.max(raw[k], res[k + 1]) : raw[k];
    // Smooth (forward filter keeps res ≥ the suffix maximum, so the content still fits) in log space.
    const tau = Math.max(0.5, 1.5 * speed);
    const a = 1 - Math.exp(-step / tau);
    for (let k = 1; k < n; k++) res[k] = Math.exp(Math.log(res[k - 1]) + (Math.log(res[k]) - Math.log(res[k - 1])) * a);
    // Centre: middle of the remaining box (whole-leg centre while gated), smoothed, then clamped into the range
    // that keeps the box in the frame at the chosen resolution.
    const cr = new Float64Array(n);
    const cf = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const gated = k < kStart;
      const dr = gated ? wholeC[0] : (rmin[k] + rmax[k]) / 2;
      const df = gated ? wholeC[1] : (fmin[k] + fmax[k]) / 2;
      cr[k] = k === 0 ? dr : cr[k - 1] + (dr - cr[k - 1]) * a;
      cf[k] = k === 0 ? df : cf[k - 1] + (df - cf[k - 1]) * a;
      const hw = (w / 2) * res[k];
      const hh = (h / 2) * res[k];
      const clampAxis = (c: number, lo: number, hi: number, half: number) =>
        hi - lo >= 2 * half ? (lo + hi) / 2 : Math.min(lo + half, Math.max(hi - half, c));
      cr[k] = clampAxis(cr[k], rmin[k], rmax[k], hw);
      cf[k] = clampAxis(cf[k], fmin[k], fmax[k], hh);
    }
    return { t0, step, res, cr, cf, pans };
  }

  /** A leg plan's fitted view at t: its centre, or panning with the runner when it does not fit. */
  private panView(L: LegPlan, li: number, t: number): { center: [number, number]; res: number } {
    const { settings, frame, course, crsCode } = this.i;
    let center = L.center;
    const res = L.resolution;
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
    return { center, res };
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
    const end = this.tBlendEnd[li];
    if (li > 0 && t < end) {
      const A = this.legView(li - 1, Math.min(t, this.tStart[li]));
      const B = this.legView(li, end);
      return state(this.blend(A, B, (t - this.tStart[li]) / Math.max(1e-6, end - this.tStart[li])));
    }
    const last = this.legs[n - 1];
    if (this.overview && li === n - 1 && t > last.t1) {
      const s = last.t1 + this.i.settings.transitionDelay * this.timeScale;
      const D = this.i.transitionOverride ?? this.transitionTrack;
      const A = this.legView(li, last.t1);
      const B: ViewState = this.overview;
      return state(t <= s ? A : this.blend(A, B, (t - s) / Math.max(1e-6, D)));
    }
    return state(this.legView(li, Math.min(t, li === n - 1 ? last.t1 : t)));
  }
}
