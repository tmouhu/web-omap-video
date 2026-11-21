/**
 * Deterministic animation timeline (EN-14). `frameStateAt(t, frame)` is a pure function of the inputs and t,
 * so preview and export render identical frames.
 * - FREE MODE (STORY-4/5/6): follow the runner, optional heading-up, look-ahead.
 * - COURSE MODE (EPIC-4): leg-oriented camera from `CourseCamera`, plus route-choice visibility (STORY-31).
 */
import { forward, gridConvergence, pointScale } from '../geo/crs';
import { groundResolutionForScale, normalizeAngle, toRad, type LatLon } from '../geo/geo';
import type { Course } from '../course/course';
import type { Passing } from '../course/match';
import type { Track, TrackPoint } from '../track/track';
import { CourseCamera, type CourseCameraSettings } from './courseCamera';

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
}

export const DEFAULT_FREE_MODE: FreeModeSettings = { scale: 10000, headingUp: true, lookAhead: 0.2 };

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
}

export const DEFAULT_ROUTE_DISPLAY: RouteDisplaySettings = {
  appear: 'settled',
  fadeIn: 0.3,
  hold: 6,
  fadeOut: 1,
  wholeLeg: false,
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
  ) {
    // Resolution fixed per track (scale factor at the track centre) so the scale never wobbles.
    this.resolution = resolutionForScale(settings.scale, crsCode, track);
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
      const shownAt = s.legIndex === 0 ? legStart : cm.routes.appear === 'transition' ? s.legShownAt : s.legSettledAt;
      return {
        ...base,
        view: s.view,
        legIndex: s.legIndex,
        legStartT: legStart,
        routeAlpha: routeAlpha(t, shownAt, s.legEndsAt, cm.routes, cm.speed),
      };
    }

    const up = this.settings.headingUp ? gridHeading : 0;
    const off = this.settings.lookAhead * frame.height * this.resolution;
    const a = toRad(up);
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

/** Route-choice opacity: fade in at `start`, hold, fade out; never past the end of the leg. */
export function routeAlpha(t: number, start: number, legEnd: number, r: RouteDisplaySettings, speed: number): number {
  if (!Number.isFinite(start) || t < start || t >= legEnd) return 0;
  const fi = Math.max(1e-6, r.fadeIn * speed);
  const x = t - start;
  if (x < fi) return x / fi;
  if (r.wholeLeg) return 1;
  const hold = r.hold * speed;
  if (x < fi + hold) return 1;
  const fo = Math.max(1e-6, r.fadeOut * speed);
  return Math.max(0, 1 - (x - fi - hold) / fo);
}

/** View-CRS units per CSS px that show `scale` (1:scale at 96 CSS px/inch) at the track centre. */
export function resolutionForScale(scale: number, crsCode: string, track: Track): number {
  return groundResolutionForScale(scale) * pointScale(crsCode, track.center());
}
