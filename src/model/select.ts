import { displayOrder } from '../store/sort.js';
import type { Prompt, State } from './types.js';

export const tagKey = (t: string): string => t.toLowerCase();
export const tagEq = (a: string, b: string): boolean => tagKey(a) === tagKey(b);

/** All ids in display order, ignoring the search. */
export function fullOrder(state: { prompts: ReadonlyMap<string, Prompt>; sort: readonly string[] }): string[] {
  return displayOrder(state.prompts.keys(), state.sort);
}

/**
 * Split a search into lowercase tokens: space-separated words, or text in
 * double quotes taken as one token, spaces included. An unclosed quote runs
 * to the end.
 */
export function searchTokens(search: string): string[] {
  const tokens: string[] = [];
  for (const m of search.matchAll(/"([^"]*)"?|[^\s"]+/g)) {
    const t = (m[1] ?? m[0]).toLowerCase();
    if (t.trim() !== '') tokens.push(t);
  }
  return tokens;
}

/** True when every token is in the title, the text, or a tag, case-insensitively. */
export function matchesSearch(prompt: Prompt, search: string): boolean {
  const fields = [prompt.title, prompt.text, ...prompt.tags].map((f) => f.toLowerCase());
  return searchTokens(search).every((t) => fields.some((f) => f.includes(t)));
}

/** Ids in display order that match the search. */
export function visibleIds(state: Pick<State, 'prompts' | 'sort' | 'search'>): string[] {
  return fullOrder(state).filter((id) => matchesSearch(state.prompts.get(id)!, state.search));
}

/** Archived ids matching `search`, newest first. */
export function archivedIds(archived: ReadonlyMap<string, Prompt>, search: string): string[] {
  return [...archived.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).filter((id) => matchesSearch(archived.get(id)!, search));
}

/** Every id in use, archived ones included; new ids must avoid them all. */
export function takenIds(state: { prompts: ReadonlyMap<string, Prompt>; archived: ReadonlyMap<string, Prompt> }): Set<string> {
  return new Set([...state.prompts.keys(), ...state.archived.keys()]);
}

/** Every tag in use, deduplicated case-insensitively, first spelling wins, sorted. */
export function allTags(prompts: Iterable<Prompt>): string[] {
  const seen = new Map<string, string>();
  for (const p of prompts) {
    for (const t of p.tags) if (!seen.has(tagKey(t))) seen.set(tagKey(t), t);
  }
  return [...seen.values()].sort((a, b) => tagKey(a).localeCompare(tagKey(b)));
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

const TAG_RULE = 'tags use only letters, numbers, - and _';

export function validateTag(tag: string): string | null {
  const t = tag.trim();
  if (t === '') return 'tag is empty';
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return TAG_RULE;
  return null;
}
