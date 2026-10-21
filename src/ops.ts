/**
 * Store operations shared by the app and the command-line flags. Each
 * writes to disk and returns what changed; callers update their own state.
 * Errors from the filesystem are thrown.
 */
import { allTags, canonicalTag, fullOrder, tagEq, takenIds } from './model/select.js';
import type { Fs } from './store/fs.js';
import type { Paths } from './store/paths.js';
import { archivePrompt, cleanTitle, createPrompt, restorePrompt, updatePrompt, type Prompt } from './store/prompts.js';
import { moveInOrder, saveSort } from './store/sort.js';

export interface Data {
  prompts: ReadonlyMap<string, Prompt>;
  archived: ReadonlyMap<string, Prompt>;
  sort: readonly string[];
}

/** A problem with an entered title, or null. */
export function titleProblem(title: string): string | null {
  if (/[\r\n]/.test(title)) return 'titles may not contain line breaks';
  if (cleanTitle(title) === '') return 'title is empty';
  return null;
}

/** `tags` with existing spellings reused and case-insensitive duplicates dropped. */
export function canonicalTags(data: Data, tags: readonly string[], keep: readonly string[] = []): string[] {
  const existing = allTags([...data.prompts.values(), ...data.archived.values()]);
  const out = [...keep];
  for (const t of tags) {
    const tag = canonicalTag(t.trim(), existing);
    if (!out.some((x) => tagEq(x, tag))) out.push(tag);
  }
  return out;
}

/** Create a prompt first in the sort order. */
export function create(
  fs: Fs,
  paths: Paths,
  data: Data,
  fields: { title: string; tags?: readonly string[]; text?: string },
  now: Date,
): { prompt: Prompt; sort: string[] } {
  const tags = canonicalTags(data, fields.tags ?? []);
  const prompt = createPrompt(fs, paths, fields.title, takenIds(data), now, tags, fields.text ?? '');
  const sort = [prompt.id, ...fullOrder(data)];
  saveSort(fs, paths, sort);
  return { prompt, sort };
}

export function retitle(fs: Fs, paths: Paths, data: Data, id: string, title: string): Prompt {
  return updatePrompt(fs, paths, data.prompts.get(id)!, { title: cleanTitle(title) });
}

export function setTags(fs: Fs, paths: Paths, data: Data, id: string, tags: readonly string[]): Prompt {
  return updatePrompt(fs, paths, data.prompts.get(id)!, { tags: canonicalTags(data, tags) });
}

export function addTags(fs: Fs, paths: Paths, data: Data, id: string, tags: readonly string[]): Prompt {
  const prompt = data.prompts.get(id)!;
  return updatePrompt(fs, paths, prompt, { tags: canonicalTags(data, tags, prompt.tags) });
}

export function removeTags(fs: Fs, paths: Paths, data: Data, id: string, tags: readonly string[]): Prompt {
  const prompt = data.prompts.get(id)!;
  return updatePrompt(fs, paths, prompt, { tags: prompt.tags.filter((t) => !tags.some((r) => tagEq(r.trim(), t))) });
}

export function writeText(fs: Fs, paths: Paths, data: Data, id: string, text: string): Prompt {
  return updatePrompt(fs, paths, data.prompts.get(id)!, { text });
}

/** Move `id` by `by` steps within `visible`. Returns the new order, or null when nothing moves. */
export function moveBy(fs: Fs, paths: Paths, data: Data, visible: readonly string[], id: string, by: number): string[] | null {
  const sort = moveInOrder(fullOrder(data), visible, id, by);
  if (sort) saveSort(fs, paths, sort);
  return sort;
}

/** Move `id` to 1-based `position` in the display order, clamped to the ends. */
export function moveTo(fs: Fs, paths: Paths, data: Data, id: string, position: number): string[] | null {
  const full = fullOrder(data);
  return moveBy(fs, paths, data, full, id, position - 1 - full.indexOf(id));
}

/**
 * Move each prompt to `archive/` and drop it from the sort order. Stops at
 * the first failure; `archived` lists the ids moved before it.
 */
export function archive(fs: Fs, paths: Paths, data: Data, ids: Iterable<string>): { archived: string[]; sort: string[]; error: Error | null } {
  const archived: string[] = [];
  let error: Error | null = null;
  for (const id of ids) {
    try {
      archivePrompt(fs, paths, id);
      archived.push(id);
    } catch (e) {
      error = e as Error;
      break;
    }
  }
  const sort = fullOrder(data).filter((id) => !archived.includes(id));
  if (archived.length > 0) saveSort(fs, paths, sort);
  return { archived, sort, error };
}

/** Move an archived prompt back, first in the sort order. */
export function restore(fs: Fs, paths: Paths, data: Data, id: string): { prompt: Prompt; sort: string[] } {
  restorePrompt(fs, paths, id);
  const sort = [id, ...fullOrder(data)];
  saveSort(fs, paths, sort);
  return { prompt: data.archived.get(id)!, sort };
}
