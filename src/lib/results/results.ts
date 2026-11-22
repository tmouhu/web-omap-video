/**
 * Result lists in IOF XML 2.0.3 and 3.0 (STORY-41): classes, competitors and split times, normalised to
 * one model. Result services (e.g. Navisport) export both versions; they differ in element names, time
 * formats (2.0: local `HH:MM:SS` without zone; 3.0: ISO 8601 / seconds) and how missing punches are written
 * (2.0: omitted; 3.0: `status="Missing"`).
 */
import { UserError } from '../i18n/core';

export interface Competitor {
  name: string;
  club: string;
  /** IOF status as written (`OK`, `MissingPunch`, `Disqualified`, `DidNotFinish`, …). */
  status: string;
  /** Official position, if any. */
  position: number | null;
  /** Start as absolute epoch ms when the file gives a time zone (IOF 3.0 with offset), else null. */
  startMs: number | null;
  /** Start as local seconds of day when the zone is unknown (IOF 2.0), else null. */
  startClock: number | null;
  /** Elapsed seconds at each class control (same order as `ResultClass.controls`); null = missing punch. */
  splits: (number | null)[];
  /** Elapsed seconds at the finish (total time), null if unknown. */
  finish: number | null;
}

export interface ResultClass {
  name: string;
  /** Control codes in course order (finish excluded). */
  controls: string[];
  competitors: Competitor[];
}

export interface ResultFile {
  version: '2.0.3' | '3.0';
  event: string;
  /** Event date `YYYY-MM-DD` (used with `startClock`), if known. */
  date: string | null;
  classes: ResultClass[];
}

/** Which competitors define the best leg / total times. */
export type ReferenceMode = 'ok' | 'all';

/** Imported results stored in the project: the chosen class only, plus the sync settings. */
export interface ResultsDoc {
  /** File name, URL or `navisport:<event id>`. */
  source: string;
  version: ResultFile['version'];
  event: string;
  date: string | null;
  cls: ResultClass;
  /** Index of the user's own result in `cls.competitors`. */
  runner: number | null;
  reference: ReferenceMode;
  /** Punching-system clock → GPS clock offset (s), added to the punch times. */
  clockOffset: number;
  /** UTC offset (min) for local start clock times (IOF 2.0); null = guess from the GPX. */
  tzOffsetMin: number | null;
}

export const isOk = (c: { status: string }) => c.status === 'OK';

const kids = (el: Element | undefined, name: string) =>
  el ? Array.from(el.children).filter((c) => c.localName === name) : [];
const kid = (el: Element | undefined, ...path: string[]): Element | undefined => {
  let cur = el;
  for (const p of path) cur = cur && kids(cur, p)[0];
  return cur;
};
const text = (el: Element | undefined) => el?.textContent?.trim() ?? '';

/** True if the XML text looks like a result list (cheap check before parsing). */
export const isResultListXml = (xml: string) => /<ResultList[\s>]/.test(xml.slice(0, 4000));

/** `HH:MM:SS`, `MM:SS`, `SS` (optionally with decimals) → seconds; null if empty/invalid. */
export function parseClockText(s: string): number | null {
  if (!s.trim()) return null;
  const parts = s.trim().split(':').map(Number);
  if (parts.some((v) => !Number.isFinite(v)) || parts.length > 3) return null;
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

/** Finish pseudo-controls used as the last split by result systems. */
const isFinishCode = (code: string) => /^(m|f|finish|maali|mål)$/i.test(code);

interface RawSplit {
  code: string;
  time: number | null;
  seq: number | null;
}

interface RawCompetitor extends Omit<Competitor, 'splits' | 'finish'> {
  raw: RawSplit[];
  total: number | null;
}

export function parseResultList(xml: string): ResultFile {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new UserError('err.notXml');
  const root = doc.documentElement;
  if (root.localName !== 'ResultList') throw new UserError('err.notResultList');
  const v3 = root.getAttribute('iofVersion')?.startsWith('3') || root.namespaceURI?.includes('/3.0') || false;
  const file = v3 ? parseV3(root) : parseV2(root);
  if (!file.classes.length) throw new UserError('err.noResults');
  return file;
}

// ---------------------------------------------------------------- IOF XML 3.0

function personName(p: Element | undefined, nameEl: string): string {
  const n = kid(p, nameEl);
  return [text(kid(n, 'Given')), text(kid(n, 'Family'))].filter(Boolean).join(' ');
}

/** ISO date-time: absolute when it carries a zone, else local seconds of day. */
function isoStart(s: string): { startMs: number | null; startClock: number | null } {
  if (!s) return { startMs: null, startClock: null };
  if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) {
    const ms = Date.parse(s);
    return { startMs: Number.isFinite(ms) ? ms : null, startClock: null };
  }
  const m = /T(\d\d:\d\d:\d\d(?:\.\d+)?)/.exec(s);
  return { startMs: null, startClock: m ? parseClockText(m[1]) : null };
}

function parseV3(root: Element): ResultFile {
  const event = kid(root, 'Event');
  const classes: ResultClass[] = [];
  for (const cr of kids(root, 'ClassResult')) {
    const name = text(kid(cr, 'Class', 'Name')) || text(kid(cr, 'Class', 'ShortName'));
    const raws: RawCompetitor[] = [];
    for (const pr of kids(cr, 'PersonResult')) {
      // Multi-race files: several <Result>; use the first.
      const r = kid(pr, 'Result');
      if (!r) continue;
      const raw: RawSplit[] = [];
      for (const st of kids(r, 'SplitTime')) {
        const status = st.getAttribute('status') ?? '';
        if (status === 'Additional') continue;
        const tv = parseFloat(text(kid(st, 'Time')));
        raw.push({
          code: text(kid(st, 'ControlCode')),
          time: status === 'Missing' || !Number.isFinite(tv) ? null : tv,
          seq: null,
        });
      }
      const total = parseFloat(text(kid(r, 'Time')));
      const pos = parseInt(text(kid(r, 'Position')), 10);
      raws.push({
        name: personName(kid(pr, 'Person'), 'Name'),
        club: text(kid(pr, 'Organisation', 'ShortName')) || text(kid(pr, 'Organisation', 'Name')),
        status: text(kid(r, 'Status')) || 'Unknown',
        position: Number.isFinite(pos) ? pos : null,
        ...isoStart(text(kid(r, 'StartTime'))),
        raw,
        total: Number.isFinite(total) ? total : null,
      });
    }
    classes.push(buildClass(name, raws));
  }
  return {
    version: '3.0',
    event: text(kid(event, 'Name')),
    date: text(kid(event, 'StartTime', 'Date')) || null,
    classes: classes.filter((c) => c.competitors.length),
  };
}

// ---------------------------------------------------------------- IOF XML 2.0.3

function parseV2(root: Element): ResultFile {
  const event = kid(root, 'Event');
  const eventDate = text(kid(event, 'StartDate', 'Date')) || null;
  const classes: ResultClass[] = [];
  for (const cr of kids(root, 'ClassResult')) {
    const name =
      text(kid(cr, 'ClassShortName')) || text(kid(cr, 'Class', 'ClassShortName')) || text(kid(cr, 'Class', 'Name'));
    const raws: RawCompetitor[] = [];
    for (const pr of kids(cr, 'PersonResult')) {
      const r = kid(pr, 'Result') ?? kid(pr, 'RaceResult', 'Result');
      if (!r) continue;
      const person = kid(pr, 'Person');
      const raw: RawSplit[] = [];
      for (const st of kids(r, 'SplitTime')) {
        const seq = parseInt(st.getAttribute('sequence') ?? '', 10);
        const status = st.getAttribute('status') ?? '';
        const tv = parseClockText(text(kid(st, 'Time')));
        raw.push({
          code: text(kid(st, 'ControlCode')),
          time: status === 'missing' || status === 'Missing' ? null : tv,
          seq: Number.isFinite(seq) ? seq : null,
        });
      }
      const pos = parseInt(text(kid(r, 'ResultPosition')), 10);
      const club = kid(person, 'Club') ?? kid(pr, 'Club');
      raws.push({
        name: personName(person, 'PersonName'),
        club: text(kid(club, 'ShortName')) || text(kid(club, 'Name')),
        status: kid(r, 'CompetitorStatus')?.getAttribute('value') ?? 'Unknown',
        position: Number.isFinite(pos) ? pos : null,
        startMs: null,
        startClock: parseClockText(text(kid(r, 'StartTime', 'Clock'))),
        raw,
        total: parseClockText(text(kid(r, 'Time'))),
      });
    }
    classes.push(buildClass(name, raws));
  }
  return {
    version: '2.0.3',
    event: text(kid(event, 'Name')),
    date: eventDate,
    classes: classes.filter((c) => c.competitors.length),
  };
}

// ---------------------------------------------------------------- normalisation

/**
 * Derives the class control sequence and aligns every competitor's splits to it: by `sequence`
 * (IOF 2.0) when present, else by index when the lengths match, else greedily by control code.
 */
function buildClass(name: string, raws: RawCompetitor[]): ResultClass {
  const controlsOf = (r: RawCompetitor) => {
    const s = r.raw.slice();
    if (s.length && isFinishCode(s[s.length - 1].code)) s.pop();
    return s;
  };
  let controls: string[];
  const withSeq = raws.some((r) => r.raw.some((s) => s.seq !== null));
  if (withSeq) {
    const bySeq = new Map<number, Map<string, number>>();
    for (const r of raws)
      for (const s of controlsOf(r)) {
        if (s.seq === null) continue;
        const m = bySeq.get(s.seq) ?? new Map<string, number>();
        m.set(s.code, (m.get(s.code) ?? 0) + 1);
        bySeq.set(s.seq, m);
      }
    const seqs = [...bySeq.keys()].sort((a, b) => a - b);
    controls = seqs.map((q) => [...bySeq.get(q)!.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    const index = new Map(seqs.map((q, i) => [q, i]));
    return {
      name,
      controls,
      competitors: raws.map((r) => {
        const splits: (number | null)[] = controls.map(() => null);
        for (const s of controlsOf(r)) if (s.seq !== null && index.has(s.seq)) splits[index.get(s.seq)!] = s.time;
        return finishCompetitor(r, splits);
      }),
    };
  }
  // Longest split list among OK competitors (else anyone) defines the sequence.
  const ref = [...raws].sort(
    (a, b) => Number(isOk(b)) - Number(isOk(a)) || controlsOf(b).length - controlsOf(a).length,
  )[0];
  controls = ref ? controlsOf(ref).map((s) => s.code) : [];
  return {
    name,
    controls,
    competitors: raws.map((r) => {
      const own = controlsOf(r);
      const splits: (number | null)[] = controls.map(() => null);
      if (own.length === controls.length) own.forEach((s, i) => (splits[i] = s.time));
      else {
        let k = 0;
        for (const s of own) {
          while (k < controls.length && controls[k] !== s.code) k++;
          if (k < controls.length) splits[k++] = s.time;
        }
      }
      return finishCompetitor(r, splits);
    }),
  };
}

function finishCompetitor(r: RawCompetitor, splits: (number | null)[]): Competitor {
  const last = r.raw[r.raw.length - 1];
  const finish = last && isFinishCode(last.code) && last.time !== null ? last.time : r.total;
  return {
    name: r.name,
    club: r.club,
    status: r.status,
    position: r.position,
    startMs: r.startMs,
    startClock: r.startClock,
    splits,
    finish,
  };
}
