import type { Fs } from './fs.js';
import { parseSettings, serializeSettings } from './format.js';
import type { Paths } from './paths.js';

export interface AppSettings {
  editor?: string;
}

export const SETTING_KEYS = ['editor'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export interface LoadResult<T> {
  value: T;
  errors: string[];
}

export function loadSettings(fs: Fs, paths: Paths): LoadResult<AppSettings> {
  const errors: string[] = [];
  const value: AppSettings = {};
  let parsed: Record<string, string>;
  try {
    parsed = parseSettings(fs.readFile(paths.settings));
  } catch (e) {
    return { value, errors: [`settings.txt: ${(e as Error).message}`] };
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'editor') value.editor = v;
    else errors.push(`settings.txt: unknown key "${k}"`);
  }
  return { value, errors };
}

export function saveSettings(fs: Fs, paths: Paths, settings: AppSettings): void {
  const out: Record<string, string> = {};
  if (settings.editor !== undefined && settings.editor !== '') out.editor = settings.editor;
  fs.writeFile(paths.settings, serializeSettings(out));
}

/** Resolve the editor shell command: setting, then $EDITOR, then vi. */
export function resolveEditor(settings: AppSettings, env: Record<string, string | undefined>): string {
  return settings.editor?.trim() || env.EDITOR?.trim() || 'vi';
}
