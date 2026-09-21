import type { AppSettings, Message, Modal, Prompt, State } from './types.js';
import { tagEq, visibleIds } from './select.js';

export interface StoreSnapshot {
  prompts: Map<string, Prompt>;
  sort: string[];
  settings: AppSettings;
}

export type Action =
  | { type: 'upsertPrompt'; prompt: Prompt }
  | { type: 'removePrompts'; ids: string[] }
  | { type: 'replaceStore'; store: StoreSnapshot }
  | { type: 'setSort'; sort: string[] }
  | { type: 'setSettings'; settings: AppSettings }
  | { type: 'select'; id: string }
  | { type: 'move'; by: number }
  | { type: 'top' }
  | { type: 'bottom' }
  | { type: 'toggleFilterTag'; tag: string }
  | { type: 'clearFilter' }
  | { type: 'setSearch'; search: string }
  | { type: 'toggleDone'; id: string }
  | { type: 'openModal'; modal: Modal }
  | { type: 'closeModal' }
  | { type: 'setMessage'; message: Message | null };

export function initialState(init: StoreSnapshot): State {
  return normalize({
    prompts: init.prompts,
    sort: init.sort,
    settings: init.settings,
    selectedId: null,
    filter: [],
    search: '',
    done: new Set(),
    modal: null,
    message: null,
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
      const done = new Set(s.done);
      for (const id of a.ids) {
        prompts.delete(id);
        done.delete(id);
      }
      return { ...s, prompts, done, sort: s.sort.filter((id) => !a.ids.includes(id)) };
    }
    case 'replaceStore': {
      const done = new Set([...s.done].filter((id) => a.store.prompts.has(id)));
      return { ...s, prompts: a.store.prompts, sort: a.store.sort, settings: a.store.settings, done };
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
    case 'setSearch':
      return { ...s, search: a.search };
    case 'toggleDone': {
      const done = new Set(s.done);
      if (done.has(a.id)) done.delete(a.id);
      else done.add(a.id);
      return { ...s, done };
    }
    case 'openModal':
      return { ...s, modal: a.modal, message: null };
    case 'closeModal':
      return { ...s, modal: null };
    case 'setMessage':
      return { ...s, message: a.message };
  }
}

/** Keep the selection invariant: one visible item selected when any exist. */
function normalize(s: State): State {
  const ids = visibleIds(s);
  if (ids.length === 0) return s.selectedId === null ? s : { ...s, selectedId: null };
  if (s.selectedId !== null && ids.includes(s.selectedId)) return s;
  return { ...s, selectedId: ids[0]! };
}
