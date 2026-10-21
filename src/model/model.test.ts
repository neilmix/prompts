import { describe, expect, it } from 'vitest';
import { allTags, archivedIds, canonicalTag, completeTag, matchesSearch, searchTokens, takenIds, validateTag, visibleIds } from './select.js';
import { initialState, reduce, type Action } from './state.js';
import type { Prompt, State } from './types.js';

const p = (id: string, title: string, tags: string[] = [], text = ''): Prompt => ({ id, title, tags, text });

function make(prompts: Prompt[], sort: string[] = [], archived: Prompt[] = []): State {
  return initialState({
    prompts: new Map(prompts.map((x) => [x.id, x])),
    archived: new Map(archived.map((x) => [x.id, x])),
    sort,
    settings: {},
  });
}

const run = (s: State, ...actions: Action[]) => actions.reduce(reduce, s);

const A = p('20260101-000001', 'A', ['Work', 'urgent']);
const B = p('20260101-000002', 'B', ['work']);
const C = p('20260101-000003', 'C', [], 'some text');

describe('selection', () => {
  it('selects the first visible item initially and null when empty', () => {
    expect(make([A, B, C]).selectedId).toBe(C.id);
    expect(make([]).selectedId).toBeNull();
  });

  it('moves with clamping', () => {
    const s = make([A, B, C]);
    expect(run(s, { type: 'move', by: 1 }).selectedId).toBe(B.id);
    expect(run(s, { type: 'move', by: 10 }).selectedId).toBe(A.id);
    expect(run(s, { type: 'move', by: -1 }).selectedId).toBe(C.id);
    expect(run(s, { type: 'bottom' }).selectedId).toBe(A.id);
    expect(run(s, { type: 'bottom' }, { type: 'top' }).selectedId).toBe(C.id);
  });

  it('falls back to the first item when the selection disappears', () => {
    const s = run(make([A, B, C]), { type: 'select', id: A.id });
    expect(run(s, { type: 'removePrompts', ids: [A.id] }).selectedId).toBe(C.id);
    expect(run(s, { type: 'setSearch', search: 'work' }).selectedId).toBe(A.id);
    expect(run(s, { type: 'setSearch', search: 'c' }).selectedId).toBe(C.id);
  });

  it('selects the new prompt after upsert + select', () => {
    const s = run(make([A]), { type: 'upsertPrompt', prompt: C }, { type: 'select', id: C.id });
    expect(s.selectedId).toBe(C.id);
    expect(visibleIds(s)).toEqual([C.id, A.id]);
  });
});

describe('archiving', () => {
  it('toggles and is dropped on removal', () => {
    const s = run(make([A]), { type: 'toggleArchiving', id: A.id });
    expect(s.archiving.has(A.id)).toBe(true);
    expect(run(s, { type: 'toggleArchiving', id: A.id }).archiving.size).toBe(0);
    expect(run(s, { type: 'removePrompts', ids: [A.id] }).archiving.size).toBe(0);
  });

  it('lists archived ids newest first, searchable; taken ids include them', () => {
    const s = make([A], [], [B, C]);
    expect(archivedIds(s.archived, '')).toEqual([C.id, B.id]);
    expect(archivedIds(s.archived, 'work')).toEqual([B.id]);
    expect([...takenIds(s)].sort()).toEqual([A.id, B.id, C.id]);
    expect(run(s, { type: 'setArchived', archived: new Map() }).archived.size).toBe(0);
  });
});

describe('search', () => {
  it('splits on spaces; quotes keep a phrase together', () => {
    expect(searchTokens('  Foo  bar ')).toEqual(['foo', 'bar']);
    expect(searchTokens('a "Two Words" b')).toEqual(['a', 'two words', 'b']);
    expect(searchTokens('"unclosed phrase')).toEqual(['unclosed phrase']);
    expect(searchTokens('"" " " x')).toEqual(['x']);
    expect(searchTokens('')).toEqual([]);
  });

  it('matches every token against title, text or tags, case-insensitively', () => {
    const q = p('20260101-000009', 'Fix the Parser', ['backend'], 'Handle quoted strings.\nThen ship.');
    expect(matchesSearch(q, '')).toBe(true);
    expect(matchesSearch(q, 'PARSER')).toBe(true);
    expect(matchesSearch(q, 'quoted')).toBe(true);
    expect(matchesSearch(q, 'back')).toBe(true);
    expect(matchesSearch(q, 'parser backend ship')).toBe(true);
    expect(matchesSearch(q, 'parser frontend')).toBe(false);
    expect(matchesSearch(q, '"fix the"')).toBe(true);
    expect(matchesSearch(q, '"the fix"')).toBe(false);
    expect(matchesSearch(q, '"strings. then"')).toBe(false);
  });

  it('filters the visible list', () => {
    const s = run(make([A, B, C]), { type: 'setSearch', search: 'B' });
    expect(visibleIds(s)).toEqual([B.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: '' }))).toEqual([C.id, B.id, A.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'work urgent' }))).toEqual([A.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'text' }))).toEqual([C.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'zzz' }))).toEqual([]);
  });
});

describe('replaceStore', () => {
  it('swaps data and keeps selection and archive marks where ids survive', () => {
    const s = run(make([A, B, C]), { type: 'select', id: B.id }, { type: 'toggleArchiving', id: B.id }, { type: 'toggleArchiving', id: C.id });
    const r = reduce(s, {
      type: 'replaceStore',
      store: { prompts: new Map([[B.id, B], [A.id, A]]), archived: new Map([[C.id, C]]), sort: [A.id], settings: { editor: 'x' } },
    });
    expect(r.selectedId).toBe(B.id);
    expect([...r.archiving]).toEqual([B.id]);
    expect([...r.archived.keys()]).toEqual([C.id]);
    expect(r.settings).toEqual({ editor: 'x' });
    expect(visibleIds(r)).toEqual([B.id, A.id]);
  });
});

describe('removePrompts', () => {
  it('drops ids from sort too', () => {
    const s = run(make([A, B], [A.id, B.id]), { type: 'removePrompts', ids: [A.id] });
    expect(s.sort).toEqual([B.id]);
    expect(s.prompts.has(A.id)).toBe(false);
  });
});

describe('tags', () => {
  it('lists unique tags sorted, first spelling wins', () => {
    expect(allTags([A, B, C])).toEqual(['urgent', 'Work']);
    expect(allTags([B, A])).toEqual(['urgent', 'work']);
  });

  it('canonicalizes to existing spelling', () => {
    expect(canonicalTag('WORK', ['Work'])).toBe('Work');
    expect(canonicalTag('new', ['Work'])).toBe('new');
  });

  it('completes by prefix', () => {
    expect(completeTag('wo', ['urgent', 'Work'])).toBe('Work');
    expect(completeTag('', ['Work'])).toBeNull();
    expect(completeTag('z', ['Work'])).toBeNull();
  });

  it('validates', () => {
    expect(validateTag('ok')).toBeNull();
    expect(validateTag('  ')).toMatch(/empty/);
    expect(validateTag(' a_B-9 ')).toBeNull();
    for (const bad of ['a,b', 'a b', 'a.b', 'é', 'a/b']) {
      expect(validateTag(bad)).toBe('tags use only letters, numbers, - and _');
    }
  });
});
