import type { Fs } from './fs.js';
import { parseSettings, serializeSettings } from './format.js';
import { formatId, isValidId, nextFreeId } from './ids.js';
import type { Paths } from './paths.js';
import type { LoadResult } from './settings.js';

export interface Prompt {
  id: string;
  tags: string[];
  /** Never blank: its first sentence is the prompt's title (titleOf). */
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
 * A prompt's title: the first non-blank line of its text, cut after the
 * first `.`, `!` or `?` that is followed by whitespace. Tabs become spaces
 * (list output is tab-separated). Empty when the text is blank.
 */
export function titleOf(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const end = /[.!?](?=\s)/.exec(line);
  return (end ? line.slice(0, end.index + 1) : line).replace(/\t/g, ' ').trim();
}

/** True when text has nothing but whitespace; such text has no title. */
export const isBlank = (text: string): boolean => text.trim() === '';

/**
 * Split an item file into its `key: value` header and its text. The header
 * ends at the first empty line; the text starts after the second. A file
 * that ends before the text starts has empty text.
 */
export function parseItem(src: string): { header: Record<string, string>; text: string } {
  // The leading newline lets an empty header end at the file's first line.
  const s = `\n${src}`;
  const end = s.indexOf('\n\n');
  if (end < 0) return { header: parseSettings(src), text: '' };
  const header = parseSettings(s.slice(1, end + 1));
  const rest = s.slice(end + 2);
  if (rest === '') return { header, text: '' };
  if (!rest.startsWith('\n')) throw new Error('expected two empty lines after the header');
  return { header, text: rest.slice(1) };
}

/** The `tags` line is always written, empty when there are none, so the header is never empty. */
export function serializeItem(prompt: Prompt): string {
  const tags = prompt.tags.length > 0 ? serializeSettings({ tags: prompt.tags.join(', ') }) : 'tags:\n';
  return `${tags}\n\n${prompt.text}`;
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
    const problems = itemProblems(parsed);
    for (const p of problems) errors.push(`${where}: ${p}`);
    if (problems.length === 0) value.set(id, { id, tags: parseTags(parsed.header.tags), text: parsed.text });
  }
  return { value, errors };
}

function itemProblems({ header, text }: ReturnType<typeof parseItem>): string[] {
  const problems = Object.keys(header)
    .filter((k) => k !== 'tags')
    .map((k) => `unknown key "${k}"`);
  if (isBlank(text)) problems.push('empty text');
  return problems;
}

/** Read one active prompt from disk. Throws when the file is missing or invalid. */
export function readPrompt(fs: Fs, paths: Paths, id: string): Prompt {
  const parsed = parseItem(fs.readFile(paths.itemFile(id)));
  const problem = itemProblems(parsed)[0];
  if (problem) throw new Error(`items/${id}.md: ${problem}`);
  return { id, tags: parseTags(parsed.header.tags), text: parsed.text };
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

/** `taken` must hold every id in use, archived ones included. `text` must not be blank. */
export function createPrompt(
  fs: Fs,
  paths: Paths,
  text: string,
  taken: ReadonlySet<string>,
  now: Date = new Date(),
  tags: string[] = [],
): Prompt {
  const id = nextFreeId(formatId(now), taken);
  const prompt: Prompt = { id, tags, text };
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
