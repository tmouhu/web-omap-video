/**
 * Builds the SceneInput for one frame from the project data and the timeline's FrameState.
 * Used by BOTH the preview and the exporter, so they cannot drift apart.
 */
import type { FrameState } from '../anim/timeline';
import { gridConvergence } from '../geo/crs';
import { normalizeAngle } from '../geo/geo';
import type { Course } from '../course/course';
import { formatRouteLength, routeLength, routesForLeg, type RouteChoice } from '../course/routes';
import type { Track } from '../track/track';
import { decimalSep, type VideoLocale } from '../i18n/core';
import type { CourseStyle } from './overprint';
import type { SceneInput, SceneStyle } from './scene';

export interface ProjectScene {
  crsCode: string;
  track: Track;
  style: SceneStyle;
  course: Course | null;
  courseStyle: CourseStyle;
  printScale: number | null;
  routes: RouteChoice[];
  /** Language of video texts (route length decimal separator). */
  videoLocale?: VideoLocale;
  /** Track seconds per settings second (STORY-47 time base). Default 1. */
  timeScale?: number;
}

export function sceneForFrame(fs: FrameState, p: ProjectScene): SceneInput {
  const leg = fs.legIndex;
  const routes =
    p.course && leg !== null
      ? routesForLeg(p.routes, p.course, leg).map((r) => ({
          points: r.points,
          color: r.color,
          label: r.label,
          lengthText: formatRouteLength(routeLength(r), decimalSep(p.videoLocale ?? 'en')),
        }))
      : [];
  return {
    crsCode: p.crsCode,
    track: p.track,
    time: fs.t,
    heading: arrowGridHeading(fs, p),
    style: p.style,
    legStartT: fs.legStartT,
    timeScale: p.timeScale ?? 1,
    course:
      p.course && p.courseStyle.visible
        ? { course: p.course, style: p.courseStyle, printScale: p.printScale, highlightLeg: leg }
        : null,
    routes: routes.length ? { items: routes, alpha: fs.routeAlpha } : null,
  };
}

/** Grid heading of the navigation arrow (STORY-43): its own, more responsive series than the camera heading. */
export function arrowGridHeading(fs: FrameState, p: Pick<ProjectScene, 'track' | 'crsCode' | 'style'>): number {
  const h = p.track.arrowHeadingAt(fs.t, p.style.track.arrowResponsiveness);
  return normalizeAngle(h + gridConvergence(p.crsCode, fs.position));
}
