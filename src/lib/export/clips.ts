/**
 * Real-time transition clips (STORY-46): each leg change of the (sped-up) main map video is also rendered at 1× as
 * its own clip, so a section slowed down to 1× in the video editor can use a full-frame-rate transition. Outside the
 * transition every clip frame equals the main video's frame at the same track time, so the clip can be cut in and
 * out anywhere in its padding.
 */
import type { CourseCamera } from '../anim/courseCamera';

export interface TransitionClip {
  /** Leg entered by the move (course legs: 1…n−1; n = the overview after the finish). */
  legIndex: number;
  /** Track seconds of the clip's first frame (on the main video's frame grid) and its end. */
  start: number;
  end: number;
  /** Frame of the main video that shows the same track time as the clip's first frame. */
  mainFrame: number;
  /** Frames in the clip (1×). */
  frames: number;
}

export interface ClipPlanOptions {
  /** Main export range (track s). */
  rangeStart: number;
  rangeEnd: number;
  /** Main video speed (track s per video s) and frame rate. */
  speed: number;
  fps: number;
  /** Padding before the move and after its end (track s = clip s). */
  pad: number;
}

/**
 * Clip ranges from the clip camera's moves (a CourseCamera built with `transitionOverride`): from the move start
 * minus the padding to the later of the main video's move end and the clip's animation end, plus the padding,
 * clamped to the export range. Moves outside the range are skipped.
 */
export function planTransitionClips(cam: CourseCamera, o: ClipPlanOptions): TransitionClip[] {
  const out: TransitionClip[] = [];
  const step = o.speed / o.fps; // track s per main-video frame
  for (const m of cam.moves()) {
    if (!(m.start >= o.rangeStart && m.start <= o.rangeEnd)) continue;
    const mainFrame = Math.max(0, Math.floor((m.start - o.pad - o.rangeStart) / step + 1e-9));
    const start = o.rangeStart + mainFrame * step;
    const end = Math.min(o.rangeEnd, Math.max(m.end, m.animEnd) + o.pad);
    if (end <= start) continue;
    out.push({ legIndex: m.legIndex, start, end, mainFrame, frames: Math.max(1, Math.round((end - start) * o.fps)) });
  }
  return out;
}

/** Editor timecode HH:MM:SS:FF of a frame number (non-drop-frame; fractional rates rounded). */
export function timecode(frame: number, fps: number, sep = ':'): string {
  const f = Math.round(fps);
  const p = (n: number) => String(n).padStart(2, '0');
  const ff = frame % f;
  const s = Math.floor(frame / f);
  return [p(Math.floor(s / 3600)), p(Math.floor(s / 60) % 60), p(s % 60), p(ff)].join(sep);
}

/** Clip list (CSV) for lining the clips up in the editor. */
export function clipListCsv(
  clips: (TransitionClip & { file: string; label: string })[],
  o: { fps: number; speed: number },
): string {
  const rows = [
    [
      'leg',
      'file',
      'main_in_timecode',
      'main_out_timecode',
      'main_in_frame',
      'track_start_s',
      'track_end_s',
      'clip_frames',
    ],
  ];
  for (const c of clips) {
    const mainOut = c.mainFrame + Math.round(((c.end - c.start) * o.fps) / o.speed);
    rows.push([
      c.label,
      c.file,
      timecode(c.mainFrame, o.fps),
      timecode(mainOut, o.fps),
      String(c.mainFrame),
      c.start.toFixed(3),
      c.end.toFixed(3),
      String(c.frames),
    ]);
  }
  return (
    rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n'
  );
}
