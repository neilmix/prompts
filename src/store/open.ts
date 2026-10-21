import type { Fs } from './fs.js';
import { pathsFor, type Paths } from './paths.js';
import { loadPrompts, type Prompt } from './prompts.js';
import { loadSettings, type AppSettings } from './settings.js';
import { loadSort } from './sort.js';

/** The store layout this app reads and writes. See file-format.md. */
export const STORE_VERSION = 1;

export interface Store {
  paths: Paths;
  settings: AppSettings;
  prompts: Map<string, Prompt>;
  archived: Map<string, Prompt>;
  sort: string[];
}

export type LoadResult = { ok: true; store: Store } | { ok: false; errors: string[] };

export type OpenResult =
  | LoadResult
  /** `dir` exists but has no `.prompts`; the caller may offer to create it. */
  | { ok: false; missing: true; paths: Paths }
  /** `.prompts` has no VERSION file; the caller may offer to upgrade it. */
  | { ok: false; outdated: true; paths: Paths };

/** Open the store at `dir`. Does not create or change anything. */
export function openStore(fs: Fs, dir: string): OpenResult {
  if (!fs.isDir(dir)) return { ok: false, errors: [`${dir}: not a directory`] };
  const paths = pathsFor(dir);
  if (!fs.exists(paths.root)) return { ok: false, missing: true, paths };
  const version = readVersion(fs, paths);
  if (typeof version === 'string') return { ok: false, errors: [version] };
  if (version === 0) return { ok: false, outdated: true, paths };
  if (version > STORE_VERSION) {
    return {
      ok: false,
      errors: [`VERSION: .prompts is version ${version}, newer than this app supports (${STORE_VERSION}); upgrade prompts`],
    };
  }
  return loadStore(fs, paths);
}

/** The store's version: 0 when VERSION is missing, or an error message. */
export function readVersion(fs: Fs, paths: Paths): number | string {
  if (!fs.exists(paths.version)) return 0;
  if (fs.isDir(paths.version)) return 'VERSION: not a file';
  const text = fs.readFile(paths.version).trim();
  if (!/^\d+$/.test(text)) return `VERSION: invalid version "${text}"`;
  return Number(text);
}

export const README = `# .prompts

This directory holds AI prompt drafts managed by the \`prompts\` terminal app
(npm package \`@neilmix/prompts\`). Each prompt is a file in \`items/\`: a short
header with its title and tags, then its text. Archived prompts move to
\`archive/\`. \`sort.txt\` holds the display order, \`settings.txt\` the app
settings, and \`VERSION\` the layout version. All files are plain text and
safe to keep under version control.

See https://github.com/neilmix/prompts for documentation and the file format.
`;

export function initStore(fs: Fs, paths: Paths): void {
  fs.mkdir(paths.items);
  fs.mkdir(paths.archive);
  fs.writeFile(paths.readme, README);
  fs.writeFile(paths.settings, '');
  fs.writeFile(paths.sort, '');
  fs.writeFile(paths.version, `${STORE_VERSION}\n`);
}

export function loadStore(fs: Fs, paths: Paths): LoadResult {
  const errors: string[] = [];
  for (const [p, label] of [
    [paths.items, 'items'],
    [paths.archive, 'archive'],
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
  const prompts = loadPrompts(fs, paths, 'items');
  const archived = loadPrompts(fs, paths, 'archive');
  const sort = loadSort(fs, paths);
  errors.push(...settings.errors, ...prompts.errors, ...archived.errors, ...sort.errors);
  for (const id of archived.value.keys()) {
    if (prompts.value.has(id)) errors.push(`archive/${id}.md: same id as items/${id}.md`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    store: { paths, settings: settings.value, prompts: prompts.value, archived: archived.value, sort: sort.value },
  };
}
