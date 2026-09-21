import { describe, expect, it } from 'vitest';
import { MemoryFs } from './fs.js';
import { initStore, openStore } from './open.js';
import { pathsFor } from './paths.js';
import { createPrompt, deletePrompt, ensureText, loadPrompts, readText, savePrompt } from './prompts.js';
import { loadSettings, resolveEditor, saveSettings } from './settings.js';
import { displayOrder, loadSort, moveInOrder, saveSort } from './sort.js';

const P = pathsFor('/w');

function storeFs(files: Record<string, string> = {}): MemoryFs {
  return new MemoryFs({
    '/w/.prompts/index': null,
    '/w/.prompts/text': null,
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': '',
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
  });
}

describe('MemoryFs', () => {
  it('lists directory entries', () => {
    const fs = new MemoryFs({ '/a/b.txt': '1', '/a/c/d.txt': '2', '/a/e': null });
    expect(fs.readdir('/a')).toEqual(['b.txt', 'c', 'e']);
    expect(fs.isDir('/a/c')).toBe(true);
    expect(fs.isDir('/a/b.txt')).toBe(false);
  });
});

describe('openStore', () => {
  it('reports a missing .prompts without creating it', () => {
    const fs = new MemoryFs({ '/w/readme.md': 'x' });
    const r = openStore(fs, '/w');
    expect(r).toMatchObject({ ok: false, missing: true });
    expect(fs.exists('/w/.prompts')).toBe(false);
  });

  it('initStore creates the layout, after which openStore succeeds', () => {
    const fs = new MemoryFs({ '/w': null });
    initStore(fs, P);
    expect(fs.isDir('/w/.prompts/index')).toBe(true);
    expect(fs.isDir('/w/.prompts/text')).toBe(true);
    expect(fs.readFile('/w/.prompts/settings.txt')).toBe('');
    expect(fs.readFile('/w/.prompts/sort.txt')).toBe('');
    expect(openStore(fs, '/w').ok).toBe(true);
  });

  it('refuses a missing directory', () => {
    const fs = new MemoryFs();
    const r = openStore(fs, '/nope');
    expect(r.ok).toBe(false);
  });

  it('reports missing pieces', () => {
    const fs = new MemoryFs({ '/w/.prompts/settings.txt': '' });
    const r = openStore(fs, '/w');
    expect(r).toEqual({
      ok: false,
      errors: ['index/: missing directory', 'text/: missing directory', 'sort.txt: missing file'],
    });
  });

  it('loads a valid store', () => {
    const fs = storeFs({
      'settings.txt': 'editor: nano\n',
      'index/20260101-000000.txt': 'title: A\ntags: x, y\n',
      'text/20260101-000000.txt': 'body',
      'sort.txt': '20260101-000000\n',
    });
    const r = openStore(fs, '/w');
    if (!r.ok) throw new Error('errors' in r ? r.errors.join() : 'missing');
    expect(r.store.settings).toEqual({ editor: 'nano' });
    expect(r.store.prompts.get('20260101-000000')).toEqual({
      id: '20260101-000000',
      title: 'A',
      tags: ['x', 'y'],
    });
    expect(r.store.sort).toEqual(['20260101-000000']);
  });

  it('collects validation errors from every file', () => {
    const fs = storeFs({
      'settings.txt': 'color: red\n',
      'index/20260101-000000.txt': 'tags: x\n',
      'index/bad.txt': 'title: x\n',
      'index/20260101-000001.txt': 'title: ok\nextra: 1\n',
      'sort.txt': 'junk\n',
    });
    const r = openStore(fs, '/w');
    expect(r).toEqual({
      ok: false,
      errors: [
        'settings.txt: unknown key "color"',
        'index/20260101-000000.txt: missing title',
        'index/20260101-000001.txt: unknown key "extra"',
        'index/bad.txt: invalid id',
        'sort.txt: line 1: invalid id "junk"',
      ],
    });
  });
});

describe('settings', () => {
  it('saves editor and drops empty', () => {
    const fs = storeFs();
    saveSettings(fs, P, { editor: 'code --wait' });
    expect(fs.readFile(P.settings)).toBe('editor: code --wait\n');
    saveSettings(fs, P, { editor: '' });
    expect(fs.readFile(P.settings)).toBe('');
    expect(loadSettings(fs, P).value).toEqual({});
  });

  it('resolves editor in order: setting, $EDITOR, vi', () => {
    expect(resolveEditor({ editor: 'code --wait' }, { EDITOR: 'nano' })).toBe('code --wait');
    expect(resolveEditor({}, { EDITOR: 'nano' })).toBe('nano');
    expect(resolveEditor({ editor: '  ' }, {})).toBe('vi');
  });
});

describe('prompts', () => {
  it('creates with id from clock, empty text, and collision suffix', () => {
    const fs = storeFs();
    const now = new Date(2026, 8, 21, 14, 30, 5);
    const a = createPrompt(fs, P, '  Hello ', new Set(), now);
    expect(a).toEqual({ id: '20260921-143005', title: 'Hello', tags: [] });
    expect(fs.readFile(P.indexFile(a.id))).toBe('title: Hello\n');
    expect(fs.readFile(P.textFile(a.id))).toBe('');
    const b = createPrompt(fs, P, 'B', new Set([a.id]), now);
    expect(b.id).toBe('20260921-143005-2');
  });

  it('saves tags comma separated', () => {
    const fs = storeFs();
    savePrompt(fs, P, { id: '20260101-000000', title: 'T', tags: ['a', 'b c'] });
    expect(fs.readFile(P.indexFile('20260101-000000'))).toBe('title: T\ntags: a, b c\n');
    expect(loadPrompts(fs, P).value.get('20260101-000000')?.tags).toEqual(['a', 'b c']);
  });

  it('reads missing text as empty and ensures it on demand', () => {
    const fs = storeFs({ 'index/20260101-000000.txt': 'title: T\n' });
    expect(readText(fs, P, '20260101-000000')).toBe('');
    const p = ensureText(fs, P, '20260101-000000');
    expect(fs.readFile(p)).toBe('');
  });

  it('ignores text files without index files', () => {
    const fs = storeFs({ 'text/20260101-000000.txt': 'orphan' });
    expect(loadPrompts(fs, P).value.size).toBe(0);
  });

  it('deletes both files', () => {
    const fs = storeFs({ 'index/20260101-000000.txt': 'title: T\n', 'text/20260101-000000.txt': 'x' });
    deletePrompt(fs, P, '20260101-000000');
    expect(fs.exists(P.indexFile('20260101-000000'))).toBe(false);
    expect(fs.exists(P.textFile('20260101-000000'))).toBe(false);
  });
});

describe('sort', () => {
  it('round-trips', () => {
    const fs = storeFs();
    saveSort(fs, P, ['20260101-000002', '20260101-000001']);
    expect(fs.readFile(P.sort)).toBe('20260101-000002\n20260101-000001\n');
    expect(loadSort(fs, P).value).toEqual(['20260101-000002', '20260101-000001']);
  });

  it('puts unlisted ids first, newest first, then sorted order', () => {
    const ids = ['20260101-000001', '20260101-000003', '20260101-000002', '20260101-000004'];
    const sort = ['20260101-000001', 'ghost', '20260101-000002', '20260101-000001'];
    expect(displayOrder(ids, sort)).toEqual([
      '20260101-000004',
      '20260101-000003',
      '20260101-000001',
      '20260101-000002',
    ]);
  });

  it('moves within the visible list and rewrites the full order', () => {
    const full = ['a', 'b', 'c', 'd'];
    expect(moveInOrder(full, ['a', 'c'], 'c', 'up')).toEqual(['c', 'a', 'b', 'd']);
    expect(moveInOrder(full, ['a', 'c'], 'a', 'down')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(full, full, 'b', 'down')).toEqual(['a', 'c', 'b', 'd']);
    expect(moveInOrder(full, full, 'a', 'up')).toBeNull();
    expect(moveInOrder(full, full, 'd', 'down')).toBeNull();
    expect(moveInOrder(full, ['a'], 'a', 'down')).toBeNull();
  });
});
