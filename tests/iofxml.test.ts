// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseIofCourseData, writeIofCourseData } from '../src/lib/course/iofxml';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<CourseData xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0">
  <Event><Name>Test</Name></Event>
  <RaceCourseData>
    <Map><Scale>10000</Scale></Map>
    <Control type="Start"><Id>S1</Id><Position lng="24.90" lat="60.20"/></Control>
    <Control><Id>31</Id><Position lng="24.91" lat="60.21"/></Control>
    <Control><Id>32</Id><Position lng="24.92" lat="60.20"/></Control>
    <Control><Id>99</Id><MapPosition x="10" y="20" unit="mm"/></Control>
    <Control type="Finish"><Id>F1</Id><Position lng="24.905" lat="60.201"/></Control>
    <Course><Name>A</Name>
      <CourseControl type="Start"><Control>S1</Control></CourseControl>
      <CourseControl type="Control"><Control>31</Control></CourseControl>
      <CourseControl type="Control"><Control>32</Control></CourseControl>
      <CourseControl type="Finish"><Control>F1</Control></CourseControl>
    </Course>
    <Course><Name>B</Name>
      <CourseControl type="Start"><Control>S1</Control></CourseControl>
      <CourseControl type="Control"><Control>32</Control></CourseControl>
      <CourseControl type="Finish"><Control>F1</Control></CourseControl>
    </Course>
  </RaceCourseData>
</CourseData>`;

describe('IOF XML 3.0 CourseData', () => {
  it('parses courses, map scale and skips controls without positions', () => {
    const f = parseIofCourseData(XML);
    expect(f.mapScale).toBe(10000);
    expect(f.skippedControls).toEqual(['99']);
    expect(f.courses.map((c) => c.name)).toEqual(['A', 'B']);
    const a = f.courses[0];
    expect(a.points.map((p) => p.kind)).toEqual(['start', 'control', 'control', 'finish']);
    expect(a.points[1]).toMatchObject({ code: '31', lat: 60.21, lon: 24.91 });
  });

  it('round-trips through the writer', () => {
    const a = parseIofCourseData(XML).courses[0];
    const back = parseIofCourseData(writeIofCourseData(a, 10000));
    expect(back.mapScale).toBe(10000);
    expect(back.courses[0].points.map((p) => [p.kind, p.lat, p.lon, p.code])).toEqual(
      a.points.map((p) => [p.kind, p.lat, p.lon, p.code]),
    );
  });

  it('errors on other documents', () => {
    expect(() => parseIofCourseData('<ResultList/>')).toThrow(/CourseData/);
  });
});
