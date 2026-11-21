/**
 * UI language state (STORY-40). `t()` reads the reactive locale, so text in templates and $derived values updates
 * when the language changes. The VIDEO language is a project setting (app.videoLocale), independent of the UI.
 */
import {
  decimalSep,
  detectLocale,
  translate,
  UserError,
  type Locale,
  type MsgKey,
  type Params,
} from '../lib/i18n/core';
import { formatDistance } from '../lib/format';

function initial(): Locale {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'fi' || q === 'xx') return q;
    const saved = localStorage.getItem('omv-locale');
    if (saved === 'en' || saved === 'fi') return saved;
  } catch {
    /* no storage */
  }
  return detectLocale(typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));
}

class I18n {
  locale = $state<Locale>(initial());

  set(l: Locale): void {
    this.locale = l;
    try {
      if (l !== 'xx') localStorage.setItem('omv-locale', l);
    } catch {
      /* no storage */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = l === 'xx' ? 'en' : l;
  }
}

export const i18n = new I18n();
if (typeof document !== 'undefined') document.documentElement.lang = i18n.locale === 'xx' ? 'en' : i18n.locale;

export function t(key: MsgKey, params?: Params): string {
  return translate(i18n.locale, key, params);
}

/** Text for an error: translated when it is a UserError, else its message. */
export function errorText(e: unknown): string {
  if (e instanceof UserError) return t(e.key, e.params);
  return e instanceof Error ? e.message : String(e);
}

/** Distance in the UI language's number format (`1.24 km` / `1,24 km`). */
export function dist(m: number): string {
  return formatDistance(m, decimalSep(i18n.locale));
}

/** Integer with the UI language's thousands separator. */
export function int(n: number): string {
  return Math.round(n).toLocaleString(i18n.locale === 'fi' ? 'fi' : 'en');
}
