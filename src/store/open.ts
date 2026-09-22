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

export type LoadResult = { ok: true; store: Store } | { ok: false; errors: string[] };

export type OpenResult =
  | LoadResult
  /** `dir` exists but has no `.prompts`; the caller may offer to create it. */
  | { ok: false; missing: true; paths: Paths };

/** Open the store at `dir`. Does not create anything. */
export function openStore(fs: Fs, dir: string): OpenResult {
  if (!fs.isDir(dir)) return { ok: false, errors: [`${dir}: not a directory`] };
  const paths = pathsFor(dir);
  if (!fs.exists(paths.root)) return { ok: false, missing: true, paths };
  return loadStore(fs, paths);
}

export const README = `# .prompts

This directory holds AI prompt drafts managed by the \`prompts\` terminal app
(npm package \`@neilmix/prompts\`). Each prompt is an entry in \`index/\` with its
body in \`text/\`; \`sort.txt\` holds the display order and \`settings.txt\` the
app settings. All files are plain text and safe to keep under version control.

See https://github.com/neilmix/prompts for documentation and the file format.
`;

export function initStore(fs: Fs, paths: Paths): void {
  fs.mkdir(paths.index);
  fs.mkdir(paths.text);
  fs.writeFile(paths.readme, README);
  fs.writeFile(paths.settings, '');
  fs.writeFile(paths.sort, '');
}

export function loadStore(fs: Fs, paths: Paths): LoadResult {
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
