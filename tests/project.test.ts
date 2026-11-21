import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  mergeDefaults,
  migrate,
  newProjectId,
  packGpx,
  packProjectFile,
  PROJECT_VERSION,
  projectSummary,
  unpackGpx,
  unpackProjectFile,
  type ProjectDoc,
} from '../src/lib/project/project';
import { pt } from './helpers';

function doc(): ProjectDoc {
  const gpx = { name: 'Run', segments: 1, points: [pt(0, 0, 0, { hr: 120, ele: 5 }), pt(10, 0, 5)] };
  return migrate({
    version: 1,
    id: newProjectId(),
    name: 'Test',
    created: 1,
    modified: 2,
    gpx: packGpx(gpx, 'Run'),
    gpxEdits: [{ type: 'delete', from: 1, to: 1 }],
    raster: null,
    layers: [],
    course: null,
    routes: [],
    passingOverrides: { a: 123 },
    matchRadius: 60,
    settings: { speed: 2, courseCamera: { zoomInLimit: 3000 } },
  });
}

describe('project document', () => {
  it('merges settings with defaults (new keys get defaults, wrong types are rejected)', () => {
    const d = mergeDefaults({ a: 1, b: { c: 'x', d: true }, e: [1] }, { a: 'no', b: { c: 'y' }, e: [2, 3], z: 9 });
    expect(d).toEqual({ a: 1, b: { c: 'y', d: true }, e: [2, 3] });
  });

  it('migrates/validates: defaults filled, settings kept, all component kinds present', () => {
    const d = doc();
    expect(d.version).toBe(PROJECT_VERSION);
    expect(d.settings.speed).toBe(2);
    expect(d.settings.courseCamera.zoomInLimit).toBe(3000);
    expect(d.settings.courseCamera.zoomOutLimit).toBe(defaultSettings().courseCamera.zoomOutLimit);
    expect(d.settings.components.map((c) => c.kind)).toEqual(['elevation', 'pace', 'heartRate', 'time', 'distance']);
    expect(d.layers.length).toBeGreaterThan(0); // empty layer list → defaults
    expect(d.matchRadius).toBe(60);
  });

  it('rejects other files and newer versions', () => {
    expect(() => migrate('x')).toThrow(/Not an OMap Video project/);
    expect(() => migrate({ version: 99 })).toThrow(/newer version/);
  });

  it('GPX points pack and unpack losslessly', () => {
    const g = unpackGpx(doc().gpx!);
    expect(g.points[0]).toMatchObject({ hr: 120, ele: 5, cad: null });
    expect(g.points[1].time).toBe(pt(10, 0, 5).time);
  });

  it('.omvproj round trip with the raster image', async () => {
    const d = doc();
    d.raster = {
      name: 'map',
      width: 2,
      height: 2,
      printScale: 10000,
      imageType: 'image/png',
      georef: { crs: 'EPSG:3067', affine: [1, 0, 0, 0, -1, 0], source: 'world-file' },
    };
    const img = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const file = await packProjectFile(d, img);
    const back = unpackProjectFile(new Uint8Array(await file.arrayBuffer()));
    expect(back.doc).toEqual(d);
    expect(back.image?.size).toBe(3);
    expect(back.image?.type).toBe('image/png');
    expect(() => unpackProjectFile(new Uint8Array([1, 2, 3]))).toThrow(/not an OMap Video project/);
  });

  it('summary', () => {
    expect(projectSummary(doc())).toBe('2 GPS points');
  });
});
