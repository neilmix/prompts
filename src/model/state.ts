import type { AppSettings, Modal, Prompt, State } from './types.js';
import { tagEq, visibleIds } from './select.js';

export type Action =
  | { type: 'upsertPrompt'; prompt: Prompt }
  | { type: 'removePrompts'; ids: string[] }
  | { type: 'setSort'; sort: string[] }
  | { type: 'setSettings'; settings: AppSettings }
  | { type: 'select'; id: string }
  | { type: 'move'; by: number }
  | { type: 'top' }
  | { type: 'bottom' }
  | { type: 'toggleFilterTag'; tag: string }
  | { type: 'clearFilter' }
  | { type: 'toggleComplete'; id: string }
  | { type: 'openModal'; modal: Modal }
  | { type: 'closeModal' }
  | { type: 'setError'; error: string | null };

export function initialState(init: {
  prompts: Map<string, Prompt>;
  sort: string[];
  settings: AppSettings;
}): State {
  return normalize({
    prompts: init.prompts,
    sort: init.sort,
    settings: init.settings,
    selectedId: null,
    filter: [],
    completed: new Set(),
    modal: null,
    error: null,
  });
}

export function reduce(state: State, action: Action): State {
  return normalize(apply(state, action));
}

function apply(s: State, a: Action): State {
  switch (a.type) {
    case 'upsertPrompt': {
      const prompts = new Map(s.prompts);
      prompts.set(a.prompt.id, a.prompt);
      return { ...s, prompts };
    }
    case 'removePrompts': {
      const prompts = new Map(s.prompts);
      const completed = new Set(s.completed);
      for (const id of a.ids) {
        prompts.delete(id);
        completed.delete(id);
      }
      return { ...s, prompts, completed, sort: s.sort.filter((id) => !a.ids.includes(id)) };
    }
    case 'setSort':
      return { ...s, sort: a.sort };
    case 'setSettings':
      return { ...s, settings: a.settings };
    case 'select':
      return { ...s, selectedId: a.id };
    case 'move': {
      const ids = visibleIds(s);
      if (ids.length === 0) return s;
      const i = Math.max(0, ids.indexOf(s.selectedId ?? ''));
      const n = Math.min(ids.length - 1, Math.max(0, i + a.by));
      return { ...s, selectedId: ids[n]! };
    }
    case 'top': {
      const ids = visibleIds(s);
      return ids.length ? { ...s, selectedId: ids[0]! } : s;
    }
    case 'bottom': {
      const ids = visibleIds(s);
      return ids.length ? { ...s, selectedId: ids[ids.length - 1]! } : s;
    }
    case 'toggleFilterTag': {
      const has = s.filter.some((t) => tagEq(t, a.tag));
      return { ...s, filter: has ? s.filter.filter((t) => !tagEq(t, a.tag)) : [...s.filter, a.tag] };
    }
    case 'clearFilter':
      return { ...s, filter: [] };
    case 'toggleComplete': {
      const completed = new Set(s.completed);
      if (completed.has(a.id)) completed.delete(a.id);
      else completed.add(a.id);
      return { ...s, completed };
    }
    case 'openModal':
      return { ...s, modal: a.modal, error: null };
    case 'closeModal':
      return { ...s, modal: null };
    case 'setError':
      return { ...s, error: a.error };
  }
}

/** Keep the selection invariant: one visible item selected when any exist. */
function normalize(s: State): State {
  const ids = visibleIds(s);
  if (ids.length === 0) return s.selectedId === null ? s : { ...s, selectedId: null };
  if (s.selectedId !== null && ids.includes(s.selectedId)) return s;
  return { ...s, selectedId: ids[0]! };
}
