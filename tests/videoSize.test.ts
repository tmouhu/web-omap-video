import { describe, expect, it } from 'vitest';
import { autoBitrateMbps, computeVideoSize, frameCount } from '../src/lib/export/videoSize';

describe('video size', () => {
  it('keeps aspect with even dimensions', () => {
    expect(computeVideoSize(16 / 9, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(computeVideoSize(9 / 16, 1080)).toEqual({ width: 1080, height: 1920 });
    expect(computeVideoSize(1.785, 720)).toEqual({ width: 1286, height: 720 });
  });
  it('caps the long side at 3840 and shrinks the short side', () => {
    expect(computeVideoSize(3, 2160)).toEqual({ width: 3840, height: 1280 });
  });
  it('auto bitrate anchors and fps scaling', () => {
    expect(autoBitrateMbps(1920, 1080)).toBe(30);
    expect(autoBitrateMbps(2560, 1440)).toBe(45);
    expect(autoBitrateMbps(3840, 2160)).toBe(90);
    expect(autoBitrateMbps(640, 360)).toBe(5);
    expect(autoBitrateMbps(1920, 1080, 60)).toBe(60);
  });
  it('frame count is exact', () => {
    expect(frameCount(5400, 30, 1)).toBe(162000);
    expect(frameCount(100, 30, 10)).toBe(300);
  });
});
