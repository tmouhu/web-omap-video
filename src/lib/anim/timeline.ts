/**
 * Deterministic animation timeline (EN-14). `frameStateAt(t, frame)` is a pure function of the inputs and t,
 * so preview and export render identical frames.
 * - FREE MODE (STORY-4/5/6): follow the runner, optional heading-up, look-ahead.
 * - COURSE MODE (EPIC-4): leg-oriented camera from `CourseCamera`, plus route-choice visibility (STORY-31).
 */
import { forward, gridConvergence, pointScale } from '../geo/crs';
import { angleDiff, groundResolutionForScale, normalizeAngle, toRad, type LatLon } from '../geo/geo';
import type { Course } from '../course/course';
import type { Passing } from '../course/match';
import type { Track, TrackPoint } from '../track/track';
import { CourseCamera, routeAlpha, type CourseCameraSettings } from './courseCamera';

export { routeAlpha };

export interface ViewState {
  /** Centre in view-CRS coordinates. */
  center: [number, number];
  /** View-CRS units per CSS pixel. */
  resolution: number;
  /** OpenLayers rotation in radians (positive = clockwise map rotation). */
  rotation: number;
}

export interface FreeModeSettings {
  /** Map scale denominator, e.g. 10000 for 1:10 000. */
  scale: number;
  headingUp: boolean;
  /** Runner sits this fraction of the frame height below the centre (0 = centred). */
  lookAhead: number;
  /** Heading-up: direction changes smaller than this (degrees) do not turn the map (0 = off). */
  rotationDeadband: number;
  /** Heading-up: time constant of the map rotation smoothing, in VIDEO seconds (0 = off). */
  rotationSmoothing: number;
}

export const DEFAULT_FREE_MODE: FreeModeSettings = {
  scale: 10000,
  headingUp: true,
  lookAhead: 0.2,
  rotationDeadband: 20,
  rotationSmoothing: 1.5,
};

/** When route choices of a leg are shown (STORY-31). Durations in video seconds. */
export interface RouteDisplaySettings {
  /** Appear when the transition into the leg starts, or when it has finished. */
  appear: 'transition' | 'settled';
  fadeIn: number;
  /** Fully visible time. */
  hold: number;
  fadeOut: number;
  /** Keep visible for the whole leg (no fade-out until the leg ends). */
  wholeLeg: boolean;
  /** Units of fadeIn/hold/fadeOut: seconds of the video, or real (1×, track) seconds. */
  timeBase: 'video' | 'real';
}

export const DEFAULT_ROUTE_DISPLAY: RouteDisplaySettings = {
  appear: 'settled',
  fadeIn: 0.3,
  hold: 6,
  fadeOut: 1,
  wholeLeg: false,
  timeBase: 'video',
};

export interface CourseModeInput {
  course: Course;
  passings: Passing[];
  camera: CourseCameraSettings;
  routes: RouteDisplaySettings;
  /** Track seconds per video second (durations in settings are video seconds). */
  speed: number;
  /** Points to keep in view per leg (route choices). */
  legExtras?: (legIndex: number) => LatLon[];
}

export interface FrameState {
  t: number;
  view: ViewState;
  position: TrackPoint;
  positionXY: [number, number];
  /** Heading of travel as a grid bearing in the view CRS (degrees). */
  gridHeading: number;
  /** Course mode: leg shown, else null. */
  legIndex: number | null;
  /** Course mode: track time the shown leg started (its start passing), for "leg" tails. */
  legStartT: number | null;
  /** Course mode: opacity of the shown leg's route choices (0..1). */
  routeAlpha: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export class Timeline {
  readonly resolution: number;
  private cameras = new Map<string, CourseCamera>();

  constructor(
    readonly track: Track,
    readonly crsCode: string,
    readonly settings: FreeModeSettings,
    readonly courseMode: CourseModeInput | null = null,
    /** "North-up" rotation (OL radians): the orienteering map's north when a raster map is loaded, else 0. */
    readonly northRotation = 0,
    /** Track seconds per video second (free-mode rotation smoothing is in video seconds). */
    readonly speed = 1,
  ) {
    // Resolution fixed per track (scale factor at the track centre) so the scale never wobbles.
    this.resolution = resolutionForScale(settings.scale, crsCode, track);
  }

  private bearings: BearingSeries | null = null;

  /** Free-mode heading-up camera bearing (grid degrees); the raw grid heading when smoothing is off. */
  cameraBearing(t: number, gridHeading: number): number {
    const s = this.settings;
    if (!(s.rotationDeadband > 0) && !(s.rotationSmoothing > 0)) return gridHeading;
    this.bearings ??= new BearingSeries(this.track, this.crsCode, s, this.speed);
    return this.bearings.at(t);
  }

  get isCourseMode(): boolean {
    return !!this.courseMode;
  }

  /** Course camera for a frame size (cached: leg fits depend on the frame shape). */
  camera(frame: FrameSize): CourseCamera | null {
    const cm = this.courseMode;
    if (!cm) return null;
    const key = `${Math.round(frame.width)}x${Math.round(frame.height)}`;
    let cam = this.cameras.get(key);
    if (!cam) {
      cam = new CourseCamera({
        track: this.track,
        crsCode: this.crsCode,
        course: cm.course,
        passings: cm.passings,
        settings: cm.camera,
        speed: cm.speed,
        frame,
        legExtras: cm.legExtras,
        northRotation: this.northRotation,
        routeDisplay: cm.routes,
      });
      this.cameras.set(key, cam);
    }
    return cam;
  }

  frameStateAt(t: number, frame: FrameSize): FrameState {
    const pos = this.track.positionAt(t);
    const xy = forward(this.crsCode, pos);
    const gridHeading = normalizeAngle(this.track.headingAt(t) + gridConvergence(this.crsCode, pos));
    const base = { t, position: pos, positionXY: xy, gridHeading };

    const cam = this.camera(frame);
    if (cam && this.courseMode) {
      const s = cam.viewAt(t);
      const cm = this.courseMode;
      const legStart = cm.passings[s.legIndex].t;
      const shownAt = cam.routeShownAt(s.legIndex);
      return {
        ...base,
        view: s.view,
        legIndex: s.legIndex,
        legStartT: legStart,
        routeAlpha: routeAlpha(t, shownAt, s.legEndsAt, cm.routes, cm.speed),
      };
    }

    const a = this.settings.headingUp ? toRad(this.cameraBearing(t, gridHeading)) : -this.northRotation;
    const off = this.settings.lookAhead * frame.height * this.resolution;
    return {
      ...base,
      view: {
        center: [xy[0] + Math.sin(a) * off, xy[1] + Math.cos(a) * off],
        resolution: this.resolution,
        rotation: -a,
      },
      legIndex: null,
      legStartT: null,
      routeAlpha: 0,
    };
  }
}

/**
 * Free-mode camera bearing (STORY-5): the travel direction with a dead band and time smoothing, so small
 * changes in the trend do not turn the map and turns are eased – calmer at high playback speed, since the
 * smoothing is in video seconds. Precomputed over the whole track in one forward pass (dead band with a
 * "settle" rule so a sustained small offset is eventually followed) plus zero-phase smoothing: a pure function
 * of the track and settings, identical in preview and export.
 */
class BearingSeries {
  readonly step: number;
  readonly values: Float64Array;

  constructor(track: Track, crsCode: string, s: FreeModeSettings, speed: number) {
    const dur = track.duration;
    this.step = Math.max(0.25, dur / 40000);
    const n = Math.max(2, Math.ceil(dur / this.step) + 1);
    const conv = gridConvergence(crsCode, track.center());
    const v = new Float64Array(n);
    // Unwrapped grid heading.
    let prev = track.headingAt(0) + conv;
    for (let i = 0; i < n; i++) {
      prev += angleDiff(prev, track.headingAt(i * this.step) + conv);
      v[i] = prev;
    }
    // Dead band: hold the camera bearing until the heading leaves the band, or stays off by more than half of
    // it for a while (then follow it, so long gentle bends are not ignored for good).
    const dead = Math.max(0, s.rotationDeadband);
    if (dead > 0) {
      const settle = Math.max(1, s.rotationSmoothing) * 1.5 * speed;
      let target = v[0];
      let off = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(v[i] - target);
        if (d > dead) {
          target = v[i];
          off = 0;
        } else if (d > dead / 2) {
          off += this.step;
          if (off >= settle) {
            target = v[i];
            off = 0;
          }
        } else off = 0;
        v[i] = target;
      }
    }
    // Zero-phase exponential smoothing, two passes each way (smooth start and stop of the turns).
    const tau = Math.max(0, s.rotationSmoothing) * speed;
    if (tau > 0) {
      const a = 1 - Math.exp(-this.step / tau);
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < n; i++) v[i] = v[i - 1] + (v[i] - v[i - 1]) * a;
        for (let i = n - 2; i >= 0; i--) v[i] = v[i + 1] + (v[i] - v[i + 1]) * a;
      }
    }
    this.values = v;
  }

  at(t: number): number {
    const x = Math.max(0, t) / this.step;
    const i = Math.min(Math.floor(x), this.values.length - 2);
    const f = Math.min(1, x - i);
    return normalizeAngle(this.values[i] + (this.values[i + 1] - this.values[i]) * f);
  }
}

/** View-CRS units per CSS px that show `scale` (1:scale at 96 CSS px/inch) at the track centre. */
export function resolutionForScale(scale: number, crsCode: string, track: Track): number {
  return groundResolutionForScale(scale) * pointScale(crsCode, track.center());
}
