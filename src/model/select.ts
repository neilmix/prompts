import { displayOrder } from '../store/sort.js';
import type { Prompt, State } from './types.js';

export const tagKey = (t: string): string => t.toLowerCase();
export const tagEq = (a: string, b: string): boolean => tagKey(a) === tagKey(b);

/** All ids in display order, ignoring the filter. */
export function fullOrder(state: Pick<State, 'prompts' | 'sort'>): string[] {
  return displayOrder(state.prompts.keys(), state.sort);
}

export function matchesFilter(prompt: Prompt, filter: readonly string[]): boolean {
  return filter.every((f) => prompt.tags.some((t) => tagEq(t, f)));
}

export function matchesSearch(prompt: Prompt, search: string): boolean {
  return search === '' || prompt.title.toLowerCase().includes(search.toLowerCase());
}

/** Ids in display order that pass the filter and search. */
export function visibleIds(state: Pick<State, 'prompts' | 'sort' | 'filter' | 'search'>): string[] {
  return fullOrder(state).filter((id) => {
    const p = state.prompts.get(id)!;
    return matchesFilter(p, state.filter) && matchesSearch(p, state.search);
  });
}

/** Every tag in use, deduplicated case-insensitively, first spelling wins, sorted. */
export function allTags(prompts: Iterable<Prompt>): string[] {
  return [...tagCounts(prompts).keys()];
}

/** Tag → number of prompts carrying it. Keys are first-seen spellings, sorted. */
export function tagCounts(prompts: Iterable<Prompt>): Map<string, number> {
  const seen = new Map<string, { tag: string; count: number }>();
  for (const p of prompts) {
    for (const t of p.tags) {
      const k = tagKey(t);
      const e = seen.get(k);
      if (e) e.count++;
      else seen.set(k, { tag: t, count: 1 });
    }
  }
  const sorted = [...seen.values()].sort((a, b) => tagKey(a.tag).localeCompare(tagKey(b.tag)));
  return new Map(sorted.map((e) => [e.tag, e.count]));
}

/** Existing spelling of `tag`, or `tag` itself when new. */
export function canonicalTag(tag: string, existing: readonly string[]): string {
  return existing.find((t) => tagEq(t, tag)) ?? tag;
}

/** First existing tag that starts with `prefix` (case-insensitive), or null. */
export function completeTag(prefix: string, existing: readonly string[]): string | null {
  if (prefix === '') return null;
  const k = tagKey(prefix);
  return existing.find((t) => tagKey(t).startsWith(k)) ?? null;
}

export function validateTag(tag: string): string | null {
  const t = tag.trim();
  if (t === '') return 'tag is empty';
  if (t.includes(',')) return 'tags may not contain commas';
  return null;
}
