import type { Fs } from './fs.js';
import { pathsFor, type Paths } from './paths.js';
import { loadPrompts, type Prompt } from './prompts.js';
import { loadSettings, type AppSettings } from './settings.js';
import { loadSort } from './sort.js';

export interface Store {
  paths: Paths;
  settings: AppSettings;
  prompts: Map<string, Prompt>;
  sort: string[];
}

export type OpenResult =
  | { ok: true; store: Store }
  | { ok: false; errors: string[] };

export const NOT_PROMPTS_DIR = 'Not a prompts directory';

const IGNORED_ENTRIES = new Set(['.git']);

/** Open (or initialize, when `dir` is empty) the store at `dir`. */
export function openStore(fs: Fs, dir: string): OpenResult {
  if (!fs.isDir(dir)) return { ok: false, errors: [`${dir}: not a directory`] };
  const paths = pathsFor(dir);
  if (!fs.exists(paths.root)) {
    const entries = fs.readdir(dir).filter((e) => !IGNORED_ENTRIES.has(e));
    if (entries.length > 0) return { ok: false, errors: [NOT_PROMPTS_DIR] };
    initStore(fs, paths);
  }
  return loadStore(fs, paths);
}

export function initStore(fs: Fs, paths: Paths): void {
  fs.mkdir(paths.index);
  fs.mkdir(paths.text);
  fs.writeFile(paths.settings, '');
  fs.writeFile(paths.sort, '');
}

export function loadStore(fs: Fs, paths: Paths): OpenResult {
  const errors: string[] = [];
  for (const [p, label] of [
    [paths.index, 'index'],
    [paths.text, 'text'],
  ] as const) {
    if (!fs.isDir(p)) errors.push(`${label}/: missing directory`);
  }
  for (const [p, label] of [
    [paths.settings, 'settings.txt'],
    [paths.sort, 'sort.txt'],
  ] as const) {
    if (!fs.exists(p) || fs.isDir(p)) errors.push(`${label}: missing file`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const settings = loadSettings(fs, paths);
  const prompts = loadPrompts(fs, paths);
  const sort = loadSort(fs, paths);
  errors.push(...settings.errors, ...prompts.errors, ...sort.errors);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    store: { paths, settings: settings.value, prompts: prompts.value, sort: sort.value },
  };
}
