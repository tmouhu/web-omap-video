/**
 * Localisation core (STORY-40). Dictionaries are flat `key → text` maps; `{name}` placeholders are filled from
 * params. English is the source; every other language must define every key (enforced by the type `Messages`).
 * 'xx' is a pseudo-locale (dev/test): accented, ~35 % longer text to find truncation and hard-coded strings.
 */
import { en } from './en';
import { fi } from './fi';

export type MsgKey = keyof typeof en;
export type Messages = Record<MsgKey, string>;
export type Locale = 'en' | 'fi' | 'xx';
export type VideoLocale = 'en' | 'fi';
export type Params = Record<string, string | number>;

export const LOCALES: { id: Exclude<Locale, 'xx'>; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'fi', name: 'Suomi' },
];

const ACCENTS: Record<string, string> = {
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ö',
  u: 'ü',
  y: 'ý',
  A: 'Á',
  E: 'É',
  I: 'Í',
  O: 'Ö',
  U: 'Ü',
  c: 'ç',
  n: 'ñ',
  s: 'š',
};

/** Pseudo-localisation: accents + padding, placeholders kept intact. */
export function pseudo(text: string): string {
  const body = text.replace(/\{[^}]+\}|./g, (m) => (m.length > 1 ? m : (ACCENTS[m] ?? m)));
  const pad = '·'.repeat(Math.max(1, Math.round(text.length * 0.35)));
  return `[${body}${pad}]`;
}

const dictionaries: Record<Exclude<Locale, 'xx'>, Messages> = { en, fi };

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function translate(locale: Locale, key: MsgKey, params?: Params): string {
  if (locale === 'xx') return pseudo(interpolate(en[key] ?? key, params));
  return interpolate(dictionaries[locale][key] ?? en[key] ?? key, params);
}

/** Decimal separator for number formatting. */
export const decimalSep = (locale: Locale | VideoLocale) => (locale === 'fi' ? ',' : '.');

/** Picks the UI language from the browser (Finnish if preferred, else English). */
export function detectLocale(languages: readonly string[]): Exclude<Locale, 'xx'> {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'fi') return 'fi';
    if (base === 'en') return 'en';
  }
  return 'en';
}

/** An error whose message can be shown in the user's language. `message` stays English (logs, tests). */
export class UserError extends Error {
  constructor(
    readonly key: MsgKey,
    readonly params: Params = {},
  ) {
    super(interpolate(en[key], params));
  }
}
