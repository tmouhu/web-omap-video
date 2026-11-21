import { describe, expect, it } from 'vitest';
import { en } from '../src/lib/i18n/en';
import { fi } from '../src/lib/i18n/fi';
import { decimalSep, detectLocale, interpolate, pseudo, translate, UserError, type MsgKey } from '../src/lib/i18n/core';
import { elapsedDistanceText } from '../src/lib/components/components';
import { formatRouteLength } from '../src/lib/course/routes';
import { courseProblems } from '../src/lib/course/course';
import { Track } from '../src/lib/track/track';
import { pt } from './helpers';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Finnish has every key, non-empty, with the same placeholders and HTML tags', () => {
    for (const k of Object.keys(en) as MsgKey[]) {
      expect(fi[k], k).toBeTruthy();
      expect(placeholders(fi[k]), k).toEqual(placeholders(en[k]));
      expect((fi[k].match(/<\/?\w+>/g) ?? []).sort(), k).toEqual((en[k].match(/<\/?\w+>/g) ?? []).sort());
    }
    expect(Object.keys(fi).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates with parameters; unknown params stay visible', () => {
    expect(translate('en', 'gpx.edits', { n: 3 })).toBe('3 edits');
    expect(translate('fi', 'gpx.edits', { n: 3 })).toBe('3 muokkausta');
    expect(interpolate('a {x} {y}', { x: 1 })).toBe('a 1 {y}');
  });

  it('pseudo-locale brackets, accents and lengthens text but keeps placeholders', () => {
    const p = pseudo('Save file {name}');
    expect(p.startsWith('[')).toBe(true);
    expect(p).toContain('{name}');
    expect(p.length).toBeGreaterThan('Save file {name}'.length * 1.3);
    expect(translate('xx', 'app.saveFile')).toMatch(/^\[Sávé fíl/);
  });

  it('detects Finnish from the browser languages, else English', () => {
    expect(detectLocale(['fi-FI', 'en'])).toBe('fi');
    expect(detectLocale(['sv-SE', 'en-GB'])).toBe('en');
    expect(detectLocale(['de'])).toBe('en');
  });

  it('UserError keeps an English message and a key for the UI', () => {
    const e = new UserError('err.kmzNoImage', { name: 'map.jpg' });
    expect(e.message).toBe('The image "map.jpg" is missing from the KMZ file.');
    expect(translate('fi', e.key, e.params)).toBe('Kuva ”map.jpg” puuttuu KMZ-tiedostosta.');
    expect(courseProblems(null)).toEqual(['course.p.empty']);
  });
});

describe('localised numbers in videos', () => {
  const track = new Track(
    'T',
    Array.from({ length: 401 }, (_, i) => pt(i * 3.1, 0, i)),
  );
  const d = { track, t: 400, rangeStart: 0, rangeEnd: 400, origin: 0, passings: null };
  it('decimal comma in Finnish', () => {
    expect(decimalSep('fi')).toBe(',');
    expect(elapsedDistanceText({ ...d, locale: 'en' })).toBe('1.24 km');
    expect(elapsedDistanceText({ ...d, locale: 'fi' })).toBe('1,24 km');
    expect(formatRouteLength(1237, ',')).toBe('1,24 km');
  });
});
