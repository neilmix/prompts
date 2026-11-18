import type { Fs } from './fs.js';
import { parseSettings } from './format.js';
import { isValidId } from './ids.js';
import { README, readVersion, STORE_VERSION } from './open.js';
import { legacyPathsFor, type Paths } from './paths.js';
import { parseItem, parseTags, savePrompt, serializeItem, type Place, type Prompt } from './prompts.js';

/** The README version 0 wrote at setup. Replaced on upgrade unless edited. */
export const README_V0 = `# .prompts

This directory holds AI prompt drafts managed by the \`prompts\` terminal app
(npm package \`@neilmix/prompts\`). Each prompt is an entry in \`index/\` with its
body in \`text/\`; \`sort.txt\` holds the display order and \`settings.txt\` the
app settings. All files are plain text and safe to keep under version control.

See https://github.com/neilmix/prompts for documentation and the file format.
`;

/** The README version 1 wrote at setup. Replaced on upgrade unless edited. */
export const README_V1 = `# .prompts

This directory holds AI prompt drafts managed by the \`prompts\` terminal app
(npm package \`@neilmix/prompts\`). Each prompt is a file in \`items/\`: a short
header with its title and tags, then its text. Archived prompts move to
\`archive/\`. \`sort.txt\` holds the display order, \`settings.txt\` the app
settings, and \`VERSION\` the layout version. All files are plain text and
safe to keep under version control.

See https://github.com/neilmix/prompts for documentation and the file format.
`;

type UpgradeResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Upgrade an older store to the current version. Nothing is changed when
 * a file is invalid. VERSION is written only after every item file, so an
 * interrupted upgrade can be rerun.
 */
export function upgradeStore(fs: Fs, paths: Paths): UpgradeResult {
  const version = readVersion(fs, paths);
  if (version === 0) return upgradeV0(fs, paths);
  if (version === 1) return upgradeV1(fs, paths);
  return { ok: false, errors: [typeof version === 'string' ? version : `VERSION: cannot upgrade version ${version}`] };
}

/** Versions 0 and 1 kept the title in the header; version 2 makes it the text's first line. */
function withTitle(title: string, text: string): string {
  return text === '' ? `${title}\n` : `${title}\n\n${text}`;
}

/** A version 0 or 1 header's problems: unknown keys and a missing title. */
function headerProblems(header: Record<string, string>): string[] {
  const problems = Object.keys(header)
    .filter((k) => k !== 'title' && k !== 'tags')
    .map((k) => `unknown key "${k}"`);
  if ((header.title ?? '').trim() === '') problems.push('missing title');
  return problems;
}

function finish(fs: Fs, paths: Paths): void {
  if (fs.exists(paths.readme) && [README_V0, README_V1].includes(fs.readFile(paths.readme))) fs.writeFile(paths.readme, README);
  fs.writeFile(paths.version, `${STORE_VERSION}\n`);
}

/**
 * Version 0 (`index/` + `text/`) to the current layout (`items/`,
 * `archive/`, `VERSION`). Text files with no index file are left in `text/`.
 */
function upgradeV0(fs: Fs, paths: Paths): UpgradeResult {
  const legacy = legacyPathsFor(paths);
  const prompts: Prompt[] = [];
  const errors: string[] = [];
  const names = fs.isDir(legacy.index) ? fs.readdir(legacy.index) : [];
  for (const name of names) {
    const where = `index/${name}`;
    const id = name.endsWith('.txt') ? name.slice(0, -4) : '';
    if (!isValidId(id)) {
      errors.push(`${where}: not a prompt index file`);
      continue;
    }
    let header: Record<string, string>;
    try {
      header = parseSettings(fs.readFile(legacy.indexFile(id)));
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    const problems = headerProblems(header);
    for (const p of problems) errors.push(`${where}: ${p}`);
    if (problems.length > 0) continue;
    const textFile = legacy.textFile(id);
    const text = fs.exists(textFile) ? fs.readFile(textFile) : '';
    prompts.push({ id, tags: parseTags(header.tags), text: withTitle(header.title!.trim(), text) });
  }
  if (errors.length > 0) return { ok: false, errors };

  fs.mkdir(paths.items);
  fs.mkdir(paths.archive);
  for (const p of prompts) savePrompt(fs, paths, p);
  if (!fs.exists(paths.settings)) fs.writeFile(paths.settings, '');
  if (!fs.exists(paths.sort)) fs.writeFile(paths.sort, '');
  finish(fs, paths);

  for (const p of prompts) {
    fs.unlink(legacy.indexFile(p.id));
    if (fs.exists(legacy.textFile(p.id))) fs.unlink(legacy.textFile(p.id));
  }
  for (const dir of [legacy.index, legacy.text]) {
    if (fs.isDir(dir) && fs.readdir(dir).length === 0) fs.rmdir(dir);
  }
  return { ok: true };
}

/**
 * Version 1 to 2: each item file in `items/` and `archive/` loses its
 * `title` header, which becomes the first line of its text. A file with no
 * `title` key was converted by an interrupted run and is left alone.
 */
function upgradeV1(fs: Fs, paths: Paths): UpgradeResult {
  const writes: { file: string; content: string }[] = [];
  const errors: string[] = [];
  for (const place of ['items', 'archive'] as Place[]) {
    const dir = place === 'items' ? paths.items : paths.archive;
    for (const name of fs.isDir(dir) ? fs.readdir(dir) : []) {
      const where = `${place}/${name}`;
      if (!name.endsWith('.md')) {
        errors.push(`${where}: unexpected file`);
        continue;
      }
      const id = name.slice(0, -3);
      if (!isValidId(id)) {
        errors.push(`${where}: invalid id`);
        continue;
      }
      const file = place === 'items' ? paths.itemFile(id) : paths.archiveFile(id);
      let parsed: ReturnType<typeof parseItem>;
      try {
        parsed = parseItem(fs.readFile(file));
      } catch (e) {
        errors.push(`${where}: ${(e as Error).message}`);
        continue;
      }
      if (!('title' in parsed.header)) continue;
      const problems = headerProblems(parsed.header);
      for (const p of problems) errors.push(`${where}: ${p}`);
      if (problems.length > 0) continue;
      const text = withTitle(parsed.header.title!.trim(), parsed.text);
      writes.push({ file, content: serializeItem({ id, tags: parseTags(parsed.header.tags), text }) });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  for (const w of writes) fs.writeFile(w.file, w.content);
  finish(fs, paths);
  return { ok: true };
}
