import type { Fs } from './fs.js';
import { parseSettings } from './format.js';
import { isValidId } from './ids.js';
import { README, STORE_VERSION } from './open.js';
import { legacyPathsFor, type Paths } from './paths.js';
import { parseTags, savePrompt, type Prompt } from './prompts.js';

/** The README version 0 wrote at setup. Replaced on upgrade unless edited. */
export const README_V0 = `# .prompts

This directory holds AI prompt drafts managed by the \`prompts\` terminal app
(npm package \`@neilmix/prompts\`). Each prompt is an entry in \`index/\` with its
body in \`text/\`; \`sort.txt\` holds the display order and \`settings.txt\` the
app settings. All files are plain text and safe to keep under version control.

See https://github.com/neilmix/prompts for documentation and the file format.
`;

/**
 * Upgrade a version 0 store (`index/` + `text/`) to version 1 (`items/`,
 * `archive/`, `VERSION`). Nothing is changed when an index file is invalid.
 * VERSION is written only after every item file, so an interrupted upgrade
 * can be rerun. Text files with no index file are left in `text/`.
 */
export function upgradeStore(fs: Fs, paths: Paths): { ok: true } | { ok: false; errors: string[] } {
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
    const unknown = Object.keys(header).filter((k) => k !== 'title' && k !== 'tags');
    for (const k of unknown) errors.push(`${where}: unknown key "${k}"`);
    const title = (header.title ?? '').trim();
    if (title === '') errors.push(`${where}: missing title`);
    if (unknown.length > 0 || title === '') continue;
    const textFile = legacy.textFile(id);
    const text = fs.exists(textFile) ? fs.readFile(textFile) : '';
    prompts.push({ id, title, tags: parseTags(header.tags), text });
  }
  if (errors.length > 0) return { ok: false, errors };

  fs.mkdir(paths.items);
  fs.mkdir(paths.archive);
  for (const p of prompts) savePrompt(fs, paths, p);
  if (!fs.exists(paths.settings)) fs.writeFile(paths.settings, '');
  if (!fs.exists(paths.sort)) fs.writeFile(paths.sort, '');
  if (fs.exists(paths.readme) && fs.readFile(paths.readme) === README_V0) fs.writeFile(paths.readme, README);
  fs.writeFile(paths.version, `${STORE_VERSION}\n`);

  for (const p of prompts) {
    fs.unlink(legacy.indexFile(p.id));
    if (fs.exists(legacy.textFile(p.id))) fs.unlink(legacy.textFile(p.id));
  }
  for (const dir of [legacy.index, legacy.text]) {
    if (fs.isDir(dir) && fs.readdir(dir).length === 0) fs.rmdir(dir);
  }
  return { ok: true };
}
