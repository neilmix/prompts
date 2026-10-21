import type { Fs } from './fs.js';
import { parseSettings, serializeSettings } from './format.js';
import { formatId, isValidId, nextFreeId } from './ids.js';
import type { Paths } from './paths.js';
import type { LoadResult } from './settings.js';

export interface Prompt {
  id: string;
  title: string;
  tags: string[];
  text: string;
}

/** Where a prompt's file lives: `items/` (active) or `archive/`. */
export type Place = 'items' | 'archive';

export function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

/**
 * Split an item file into its `key: value` header and its text. The header
 * ends at the first empty line; the text starts after the second. A file
 * that ends before the text starts has empty text.
 */
export function parseItem(src: string): { header: Record<string, string>; text: string } {
  const end = src.indexOf('\n\n');
  if (end < 0) return { header: parseSettings(src), text: '' };
  const header = parseSettings(src.slice(0, end + 1));
  const rest = src.slice(end + 2);
  if (rest === '') return { header, text: '' };
  if (!rest.startsWith('\n')) throw new Error('expected two empty lines after the header');
  return { header, text: rest.slice(1) };
}

export function serializeItem(prompt: Prompt): string {
  const header: Record<string, string> = { title: prompt.title };
  if (prompt.tags.length > 0) header.tags = prompt.tags.join(', ');
  return `${serializeSettings(header)}\n\n${prompt.text}`;
}

const fileIn = (paths: Paths, place: Place, id: string) => (place === 'items' ? paths.itemFile(id) : paths.archiveFile(id));

/** Load every `<id>.md` in `items/` or `archive/`. */
export function loadPrompts(fs: Fs, paths: Paths, place: Place): LoadResult<Map<string, Prompt>> {
  const value = new Map<string, Prompt>();
  const errors: string[] = [];
  for (const name of fs.readdir(place === 'items' ? paths.items : paths.archive)) {
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
    let parsed: ReturnType<typeof parseItem>;
    try {
      parsed = parseItem(fs.readFile(fileIn(paths, place, id)));
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      continue;
    }
    let ok = true;
    for (const k of Object.keys(parsed.header)) {
      if (k !== 'title' && k !== 'tags') {
        errors.push(`${where}: unknown key "${k}"`);
        ok = false;
      }
    }
    const title = (parsed.header.title ?? '').trim();
    if (title === '') {
      errors.push(`${where}: missing title`);
      ok = false;
    }
    if (ok) value.set(id, { id, title, tags: parseTags(parsed.header.tags), text: parsed.text });
  }
  return { value, errors };
}

/** Read one active prompt from disk. Throws when the file is missing or invalid. */
export function readPrompt(fs: Fs, paths: Paths, id: string): Prompt {
  const { header, text } = parseItem(fs.readFile(paths.itemFile(id)));
  const title = (header.title ?? '').trim();
  if (title === '') throw new Error(`items/${id}.md: missing title`);
  return { id, title, tags: parseTags(header.tags), text };
}

export function savePrompt(fs: Fs, paths: Paths, prompt: Prompt): void {
  fs.writeFile(paths.itemFile(prompt.id), serializeItem(prompt));
}

/**
 * Apply `change` to the prompt as it is on disk now, which may differ from
 * `loaded` if another process wrote it since. `loaded` stands in when the
 * file is missing or unreadable. Saves and returns the result.
 */
export function updatePrompt(fs: Fs, paths: Paths, loaded: Prompt, change: Partial<Omit<Prompt, 'id'>>): Prompt {
  let current = loaded;
  try {
    current = readPrompt(fs, paths, loaded.id);
  } catch {
    // Missing or unreadable on disk: the loaded copy is the best we have.
  }
  const saved = { ...current, ...change };
  savePrompt(fs, paths, saved);
  return saved;
}

/** Normalize an entered title: tabs become spaces (list output is tab-separated), then trim. */
export function cleanTitle(title: string): string {
  return title.replace(/\t/g, ' ').trim();
}

/** `taken` must hold every id in use, archived ones included. */
export function createPrompt(
  fs: Fs,
  paths: Paths,
  title: string,
  taken: ReadonlySet<string>,
  now: Date = new Date(),
  tags: string[] = [],
  text = '',
): Prompt {
  const id = nextFreeId(formatId(now), taken);
  const prompt: Prompt = { id, title: cleanTitle(title), tags, text };
  savePrompt(fs, paths, prompt);
  return prompt;
}

export function archivePrompt(fs: Fs, paths: Paths, id: string): void {
  fs.mkdir(paths.archive);
  fs.rename(paths.itemFile(id), paths.archiveFile(id));
}

export function restorePrompt(fs: Fs, paths: Paths, id: string): void {
  if (fs.exists(paths.itemFile(id))) throw new Error(`items/${id}.md already exists`);
  fs.rename(paths.archiveFile(id), paths.itemFile(id));
}
