import { describe, expect, it } from 'vitest';
import { CourseCamera, DEFAULT_COURSE_CAMERA } from '../src/lib/anim/courseCamera';
import { appendPoint, emptyCourse, finishAtLast } from '../src/lib/course/course';
import { matchCourse } from '../src/lib/course/match';
import { clipListCsv, planTransitionClips, timecode } from '../src/lib/export/clips';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

const at = (n: number, e: number) => ({ lat: pt(n, e, 0).lat, lon: pt(n, e, 0).lon });
const wp: [number, number][] = [
  [0, 0],
  [0, 600],
  [500, 600],
  [500, 100],
];
let course = emptyCourse();
for (const [n, e] of wp) course = appendPoint(course, at(n, e));
course = finishAtLast(course);
const pts = [pt(0, 0, 0)];
let t = 0;
for (let k = 1; k < wp.length; k++) {
  const [n0, e0] = wp[k - 1];
  const [n1, e1] = wp[k];
  const steps = Math.round(Math.hypot(n1 - n0, e1 - e0) / 3);
  for (let s = 1; s <= steps; s++) pts.push(pt(n0 + ((n1 - n0) * s) / steps, e0 + ((e1 - e0) * s) / steps, ++t));
}
const track = new Track('T', pts);
const passings = matchCourse(track, course);
const speed = 10;
const fps = 30;
const input = {
  track,
  crsCode: 'EPSG:3067',
  course,
  passings,
  settings: { ...DEFAULT_COURSE_CAMERA, approachEnabled: false, transitionDuration: 1.5 },
  speed,
  frame: { width: 800, height: 450 },
};

describe('real-time transition clips (STORY-46)', () => {
  const main = new CourseCamera(input);
  const clipCam = new CourseCamera({ ...input, transitionOverride: 1.5 });
  const range = { rangeStart: passings[0].t, rangeEnd: passings[passings.length - 1].t };
  const clips = planTransitionClips(clipCam, { ...range, speed, fps, pad: 3 });

  it('one clip per leg change, covering the main video move plus padding, on the main frame grid', () => {
    expect(clips.map((c) => c.legIndex)).toEqual([1, 2]);
    for (const c of clips) {
      const li = c.legIndex;
      expect(c.start).toBeLessThanOrEqual(main.tStart[li] - 3 + 1e-9);
      expect(c.start).toBeGreaterThan(main.tStart[li] - 3 - speed / fps);
      expect(c.end).toBeCloseTo(main.tEnd[li] + 3, 9);
      // Frame grid: the clip start is a main-video frame time.
      expect(c.start).toBeCloseTo(range.rangeStart + (c.mainFrame * speed) / fps, 9);
      expect(c.frames).toBe(Math.round((c.end - c.start) * fps));
    }
  });

  it('clip frames equal the main video outside the move; the clip moves over 1.5 s', () => {
    for (const c of clips) {
      const li = c.legIndex;
      for (let k = 0; k < c.frames; k += 7) {
        const tt = c.start + k / fps;
        if (tt < main.tStart[li] || tt > main.tEnd[li]) expect(clipCam.viewAt(tt).view).toEqual(main.viewAt(tt).view);
      }
      expect(clipCam.tBlendEnd[li] - clipCam.tStart[li]).toBeCloseTo(1.5, 9);
    }
  });

  it('skips moves outside the export range and clamps to it', () => {
    const late = planTransitionClips(clipCam, {
      rangeStart: main.tStart[1] + 1,
      rangeEnd: main.tStart[2] + 1,
      speed,
      fps,
      pad: 3,
    });
    expect(late.map((c) => c.legIndex)).toEqual([2]);
    expect(late[0].end).toBeCloseTo(main.tStart[2] + 1, 9);
  });

  it('overview after the finish is a clip too', () => {
    const cam = new CourseCamera({
      ...input,
      settings: { ...input.settings, afterFinish: 'overview' },
      transitionOverride: 1.5,
    });
    const all = planTransitionClips(cam, { rangeStart: 0, rangeEnd: track.duration + 60, speed, fps, pad: 2 });
    expect(all.map((c) => c.legIndex)).toEqual([1, 2, 3]);
  });

  it('timecodes and clip list', () => {
    expect(timecode(0, 30)).toBe('00:00:00:00');
    expect(timecode(30 * 75 + 12, 30)).toBe('00:01:15:12');
    expect(timecode(30 * 3600, 30, '-')).toBe('01-00-00-00');
    const csv = clipListCsv([{ ...clips[0], file: 'a.mp4', label: 'leg1-2' }], { fps, speed });
    const [head, row] = csv.trim().split('\n');
    expect(head.split(',')[0]).toBe('leg');
    expect(row.split(',')[1]).toBe('a.mp4');
    expect(row.split(',')[2]).toBe(timecode(clips[0].mainFrame, fps));
  });
});
