import type { AppSettings, Message, Modal, Prompt, State } from './types.js';
import { visibleIds } from './select.js';

export interface StoreSnapshot {
  prompts: Map<string, Prompt>;
  archived: Map<string, Prompt>;
  sort: string[];
  settings: AppSettings;
}

export type Action =
  | { type: 'upsertPrompt'; prompt: Prompt }
  | { type: 'removePrompts'; ids: string[] }
  | { type: 'setArchived'; archived: Map<string, Prompt> }
  | { type: 'replaceStore'; store: StoreSnapshot }
  | { type: 'setSort'; sort: string[] }
  | { type: 'setSettings'; settings: AppSettings }
  | { type: 'select'; id: string }
  | { type: 'move'; by: number }
  | { type: 'top' }
  | { type: 'bottom' }
  | { type: 'setSearch'; search: string }
  | { type: 'toggleArchiving'; id: string }
  | { type: 'openModal'; modal: Modal }
  | { type: 'closeModal' }
  | { type: 'setMessage'; message: Message | null };

export function initialState(init: StoreSnapshot): State {
  return normalize({
    prompts: init.prompts,
    archived: init.archived,
    sort: init.sort,
    settings: init.settings,
    selectedId: null,
    search: '',
    archiving: new Set(),
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
      const archiving = new Set(s.archiving);
      for (const id of a.ids) {
        prompts.delete(id);
        archiving.delete(id);
      }
      return { ...s, prompts, archiving, sort: s.sort.filter((id) => !a.ids.includes(id)) };
    }
    case 'setArchived':
      return { ...s, archived: a.archived };
    case 'replaceStore': {
      const archiving = new Set([...s.archiving].filter((id) => a.store.prompts.has(id)));
      const { prompts, archived, sort, settings } = a.store;
      return { ...s, prompts, archived, sort, settings, archiving };
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
    case 'setSearch':
      return { ...s, search: a.search };
    case 'toggleArchiving': {
      const archiving = new Set(s.archiving);
      if (archiving.has(a.id)) archiving.delete(a.id);
      else archiving.add(a.id);
      return { ...s, archiving };
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
