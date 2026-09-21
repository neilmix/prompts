import { describe, expect, it } from 'vitest';
import { allTags, canonicalTag, completeTag, tagCounts, validateTag, visibleIds } from './select.js';
import { initialState, reduce, type Action } from './state.js';
import type { Prompt, State } from './types.js';

const p = (id: string, title: string, tags: string[] = []): Prompt => ({ id, title, tags });

function make(prompts: Prompt[], sort: string[] = []): State {
  return initialState({ prompts: new Map(prompts.map((x) => [x.id, x])), sort, settings: {} });
}

const run = (s: State, ...actions: Action[]) => actions.reduce(reduce, s);

const A = p('20260101-000001', 'A', ['Work', 'urgent']);
const B = p('20260101-000002', 'B', ['work']);
const C = p('20260101-000003', 'C');

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
    expect(run(s, { type: 'toggleFilterTag', tag: 'work' }).selectedId).toBe(A.id);
    expect(run(s, { type: 'toggleFilterTag', tag: 'urgent' }, { type: 'select', id: A.id }, { type: 'toggleFilterTag', tag: 'urgent' }).selectedId).toBe(A.id);
  });

  it('selects the new prompt after upsert + select', () => {
    const s = run(make([A]), { type: 'upsertPrompt', prompt: C }, { type: 'select', id: C.id });
    expect(s.selectedId).toBe(C.id);
    expect(visibleIds(s)).toEqual([C.id, A.id]);
  });
});

describe('filter', () => {
  it('ANDs tags case-insensitively', () => {
    const s = make([A, B, C]);
    expect(visibleIds(run(s, { type: 'toggleFilterTag', tag: 'WORK' }))).toEqual([B.id, A.id]);
    expect(
      visibleIds(run(s, { type: 'toggleFilterTag', tag: 'work' }, { type: 'toggleFilterTag', tag: 'urgent' })),
    ).toEqual([A.id]);
  });

  it('toggles and clears', () => {
    const s = run(make([A, B, C]), { type: 'toggleFilterTag', tag: 'work' });
    expect(run(s, { type: 'toggleFilterTag', tag: 'Work' }).filter).toEqual([]);
    expect(run(s, { type: 'clearFilter' }).filter).toEqual([]);
  });
});

describe('done', () => {
  it('toggles and is dropped on removal', () => {
    const s = run(make([A]), { type: 'toggleDone', id: A.id });
    expect(s.done.has(A.id)).toBe(true);
    expect(run(s, { type: 'toggleDone', id: A.id }).done.size).toBe(0);
    expect(run(s, { type: 'removePrompts', ids: [A.id] }).done.size).toBe(0);
  });
});

describe('search', () => {
  it('matches title substrings case-insensitively and combines with filter', () => {
    const s = run(make([A, B, C]), { type: 'setSearch', search: 'B' });
    expect(visibleIds(s)).toEqual([B.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: '' }))).toEqual([C.id, B.id, A.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'a' }, { type: 'toggleFilterTag', tag: 'urgent' }))).toEqual([A.id]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'b' }, { type: 'toggleFilterTag', tag: 'urgent' }))).toEqual([]);
    expect(visibleIds(run(s, { type: 'setSearch', search: 'zzz' }))).toEqual([]);
  });
});

describe('replaceStore', () => {
  it('swaps data and keeps selection, filter and done where ids survive', () => {
    const s = run(make([A, B, C]), { type: 'select', id: B.id }, { type: 'toggleDone', id: B.id }, { type: 'toggleDone', id: C.id });
    const r = reduce(s, { type: 'replaceStore', store: { prompts: new Map([[B.id, B], [A.id, A]]), sort: [A.id], settings: { editor: 'x' } } });
    expect(r.selectedId).toBe(B.id);
    expect([...r.done]).toEqual([B.id]);
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

  it('counts prompts per tag', () => {
    expect([...tagCounts([A, B, C])]).toEqual([['urgent', 1], ['Work', 2]]);
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
    expect(validateTag('a,b')).toMatch(/comma/);
  });
});
