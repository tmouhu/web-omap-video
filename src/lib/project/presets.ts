/**
 * Animation/style presets (STORY-39). A preset is a partial ProjectSettings (visual parts only: camera, course
 * style, runner/tail, route display, data-video styles). Built-ins ship with the app; user presets live in this
 * browser (localStorage) and can be exported/imported as JSON.
 */
import type { ProjectSettings } from './project';

export type PresetSettings = Partial<
  Pick<ProjectSettings, 'free' | 'style' | 'courseStyle' | 'courseCamera' | 'routeDisplay' | 'components'>
>;

export interface Preset {
  id: string;
  name: string;
  description?: string;
  builtin?: boolean;
  settings: PresetSettings;
}

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'classic-forest',
    name: 'Classic forest',
    description: '1:4 000–1:15 000, 60 s pace tail, smooth turns',
    builtin: true,
    settings: {
      courseCamera: {
        zoomInLimit: 4000,
        zoomOutLimit: 15000,
        transitionDuration: 1.5,
        easing: 'sine',
        approachEnabled: true,
        approachScale: 5000,
      } as ProjectSettings['courseCamera'],
      style: { track: { tailMode: 'seconds', tailSeconds: 60, colorMode: 'pace' } } as ProjectSettings['style'],
      courseStyle: { sizeMode: 'screen', sizeFactor: 1 } as ProjectSettings['courseStyle'],
    },
  },
  {
    id: 'sprint',
    name: 'Sprint',
    description: 'Closer zoom (1:2 000–1:6 000), quick turns, 30 s tail',
    builtin: true,
    settings: {
      courseCamera: {
        zoomInLimit: 2000,
        zoomOutLimit: 6000,
        transitionDuration: 1.0,
        easing: 'sine',
        approachEnabled: true,
        approachScale: 2500,
        approachSeconds: 6,
      } as ProjectSettings['courseCamera'],
      style: { track: { tailMode: 'seconds', tailSeconds: 30, colorMode: 'pace' } } as ProjectSettings['style'],
      courseStyle: { sizeMode: 'screen', sizeFactor: 1.2 } as ProjectSettings['courseStyle'],
      routeDisplay: { hold: 4 } as ProjectSettings['routeDisplay'],
    },
  },
  {
    id: 'coach',
    name: 'Coach analysis',
    description: 'Whole leg tail, routes visible all leg, no approach zoom',
    builtin: true,
    settings: {
      courseCamera: { approachEnabled: false, transitionDuration: 2 } as ProjectSettings['courseCamera'],
      style: { track: { tailMode: 'leg', colorMode: 'pace', showTravelled: true } } as ProjectSettings['style'],
      routeDisplay: { wholeLeg: true } as ProjectSettings['routeDisplay'],
    },
  },
];

const KEY = 'omv-presets';

export function loadUserPresets(): Preset[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.name === 'string' && p.settings) : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(list: Preset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: presets live for this session only */
  }
}

/** The visual parts of the current settings, as a preset. */
export function presetFromSettings(name: string, s: ProjectSettings): Preset {
  return {
    id: `u-${Date.now().toString(36)}`,
    name,
    settings: {
      free: s.free,
      style: s.style,
      courseStyle: s.courseStyle,
      courseCamera: s.courseCamera,
      routeDisplay: s.routeDisplay,
      components: s.components,
    },
  };
}

/** Parses an exported presets file (one preset or a list). */
export function parsePresetsJson(text: string): Preset[] {
  const v = JSON.parse(text);
  const list = Array.isArray(v) ? v : [v];
  const ok = list.filter((p) => p && typeof p.name === 'string' && typeof p.settings === 'object');
  if (!ok.length) throw new Error('No presets found in the file.');
  return ok.map((p, i) => ({ ...p, builtin: false, id: `u-${Date.now().toString(36)}-${i}` }));
}
