/**
 * Deterministic animation timeline (EN-14). `frameStateAt(t)` is a pure function of the track,
 * the settings and t, so preview and export render identical frames.
 * Currently implements FREE MODE (STORY-4/5/6); course mode (EPIC-4) plugs in here later.
 */
import { forward, gridConvergence, pointScale } from '../geo/crs';
import { groundResolutionForScale, normalizeAngle, toRad } from '../geo/geo';
import type { Track, TrackPoint } from '../track/track';

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

export interface FrameState {
  t: number;
  view: ViewState;
  position: TrackPoint;
  positionXY: [number, number];
  /** Heading of travel as a grid bearing in the view CRS (degrees). */
  gridHeading: number;
}

export class Timeline {
  readonly resolution: number;

  constructor(
    readonly track: Track,
    readonly crsCode: string,
    readonly settings: FreeModeSettings,
  ) {
    // Resolution fixed per track (scale factor at the track centre) so the scale never wobbles.
    this.resolution = resolutionForScale(settings.scale, crsCode, track);
  }

  /** @param frameCssHeight preview/export frame height in CSS px (for the look-ahead offset). */
  frameStateAt(t: number, frameCssHeight: number): FrameState {
    const pos = this.track.positionAt(t);
    const xy = forward(this.crsCode, pos);
    const gridHeading = normalizeAngle(this.track.headingAt(t) + gridConvergence(this.crsCode, pos));
    const up = this.settings.headingUp ? gridHeading : 0;
    const off = this.settings.lookAhead * frameCssHeight * this.resolution;
    const a = toRad(up);
    return {
      t,
      position: pos,
      positionXY: xy,
      gridHeading,
      view: {
        center: [xy[0] + Math.sin(a) * off, xy[1] + Math.cos(a) * off],
        resolution: this.resolution,
        rotation: -a,
      },
    };
  }
}

/** View-CRS units per CSS px that show `scale` (1:scale at 96 CSS px/inch) at the track centre. */
export function resolutionForScale(scale: number, crsCode: string, track: Track): number {
  return groundResolutionForScale(scale) * pointScale(crsCode, track.center());
}
