import type { Fs } from './fs.js';
import { parseSettings, serializeSettings } from './format.js';
import { formatId, isValidId, nextFreeId } from './ids.js';
import type { Paths } from './paths.js';
import type { LoadResult } from './settings.js';

export interface Prompt {
  id: string;
  title: string;
  tags: string[];
}

export function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

export function loadPrompts(fs: Fs, paths: Paths): LoadResult<Map<string, Prompt>> {
  const value = new Map<string, Prompt>();
  const errors: string[] = [];
  for (const name of fs.readdir(paths.index)) {
    if (!name.endsWith('.txt')) {
      errors.push(`index/${name}: unexpected file`);
      continue;
    }
    const id = name.slice(0, -4);
    if (!isValidId(id)) {
      errors.push(`index/${name}: invalid id`);
      continue;
    }
    let parsed: Record<string, string>;
    try {
      parsed = parseSettings(fs.readFile(paths.indexFile(id)));
    } catch (e) {
      errors.push(`index/${name}: ${(e as Error).message}`);
      continue;
    }
    let ok = true;
    for (const k of Object.keys(parsed)) {
      if (k !== 'title' && k !== 'tags') {
        errors.push(`index/${name}: unknown key "${k}"`);
        ok = false;
      }
    }
    const title = (parsed.title ?? '').trim();
    if (title === '') {
      errors.push(`index/${name}: missing title`);
      ok = false;
    }
    if (ok) value.set(id, { id, title, tags: parseTags(parsed.tags) });
  }
  return { value, errors };
}

export function savePrompt(fs: Fs, paths: Paths, prompt: Prompt): void {
  const out: Record<string, string> = { title: prompt.title };
  if (prompt.tags.length > 0) out.tags = prompt.tags.join(', ');
  fs.writeFile(paths.indexFile(prompt.id), serializeSettings(out));
}

export function createPrompt(
  fs: Fs,
  paths: Paths,
  title: string,
  existing: ReadonlySet<string>,
  now: Date = new Date(),
): Prompt {
  const id = nextFreeId(formatId(now), existing);
  const prompt: Prompt = { id, title: title.trim(), tags: [] };
  savePrompt(fs, paths, prompt);
  fs.writeFile(paths.textFile(id), '');
  return prompt;
}

export function readText(fs: Fs, paths: Paths, id: string): string {
  const p = paths.textFile(id);
  return fs.exists(p) ? fs.readFile(p) : '';
}

/** Make sure the text file exists so the editor has something to open. */
export function ensureText(fs: Fs, paths: Paths, id: string): string {
  const p = paths.textFile(id);
  if (!fs.exists(p)) fs.writeFile(p, '');
  return p;
}

export function deletePrompt(fs: Fs, paths: Paths, id: string): void {
  for (const p of [paths.indexFile(id), paths.textFile(id)]) {
    if (fs.exists(p)) fs.unlink(p);
  }
}
