// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GpxError, parseGpx } from '../src/lib/gpx/gpx';

describe('parseGpx', () => {
  it('parses namespaced track points with time and elevation', () => {
    const g = parseGpx(`<?xml version="1.0"?>
      <gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Run</name><trkseg>
        <trkpt lat="60.1" lon="24.9"><ele>12.5</ele><time>2026-01-01T10:00:00Z</time></trkpt>
        <trkpt lat="60.2" lon="25.0"><time>2026-01-01T10:00:05Z</time></trkpt>
      </trkseg></trk></gpx>`);
    expect(g.name).toBe('Run');
    expect(g.points[0]).toEqual({
      lat: 60.1,
      lon: 24.9,
      ele: 12.5,
      time: Date.parse('2026-01-01T10:00:00Z'),
      hr: null,
      cad: null,
    });
    expect(g.points[1].ele).toBeNull();
  });

  it('reads Garmin TrackPointExtension heart rate and cadence', () => {
    const g = parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/1"
        xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><trkseg>
      <trkpt lat="60" lon="25"><time>2026-01-01T10:00:00Z</time><extensions><gpxtpx:TrackPointExtension>
        <gpxtpx:hr>152</gpxtpx:hr><gpxtpx:cad>88</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="60.001" lon="25"><time>2026-01-01T10:00:01Z</time><extensions>
        <ns3:TrackPointExtension xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v2"><ns3:hr>155</ns3:hr></ns3:TrackPointExtension>
      </extensions></trkpt></trkseg></trk></gpx>`);
    expect(g.points.map((p) => p.hr)).toEqual([152, 155]);
    expect(g.points[0].cad).toBe(88);
  });

  it('falls back to route points and tolerates missing time', () => {
    const g = parseGpx(`<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`);
    expect(g.points.map((p) => p.time)).toEqual([null, null]);
  });

  it('rejects invalid input with a GpxError', () => {
    expect(() => parseGpx('<gpx><trk>')).toThrow(GpxError);
    expect(() => parseGpx('<gpx><trk><trkseg><trkpt lat="1" lon="2"/></trkseg></trk></gpx>')).toThrow(/two/);
  });

  it('parses the bundled sample', () => {
    const g = parseGpx(readFileSync(resolve(process.cwd(), 'public/sample.gpx'), 'utf8'));
    expect(g.points.length).toBeGreaterThan(500);
  });
});
