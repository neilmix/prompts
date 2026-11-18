import { describe, expect, it } from 'vitest';
import { MemoryFs } from './fs.js';
import { initStore, openStore, README } from './open.js';
import { pathsFor } from './paths.js';
import {
  archivePrompt,
  createPrompt,
  loadPrompts,
  parseItem,
  restorePrompt,
  savePrompt,
  serializeItem,
  titleOf,
  updatePrompt,
} from './prompts.js';
import { loadSettings, resolveEditor, saveSettings } from './settings.js';
import { displayOrder, loadSort, moveInOrder, saveSort } from './sort.js';
import { README_V0, README_V1, upgradeStore } from './upgrade.js';

const P = pathsFor('/w');
const A = '20260101-000000';

function storeFs(files: Record<string, string> = {}): MemoryFs {
  return new MemoryFs({
    '/w/.prompts/items': null,
    '/w/.prompts/archive': null,
    '/w/.prompts/VERSION': '2\n',
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

  it('renames files and removes only empty directories', () => {
    const fs = new MemoryFs({ '/a/b.txt': '1', '/c': null });
    fs.rename('/a/b.txt', '/c/b.txt');
    expect(fs.readFile('/c/b.txt')).toBe('1');
    expect(fs.exists('/a/b.txt')).toBe(false);
    expect(() => fs.rmdir('/c')).toThrow(/ENOTEMPTY/);
    fs.rmdir('/a');
    expect(fs.exists('/a')).toBe(false);
  });

  it('makes unique temp directories', () => {
    const fs = new MemoryFs();
    const a = fs.mkdtemp('x-');
    expect(fs.isDir(a)).toBe(true);
    expect(fs.mkdtemp('x-')).not.toBe(a);
  });
});

describe('openStore', () => {
  it('reports a missing .prompts without creating it', () => {
    const fs = new MemoryFs({ '/w/readme.md': 'x' });
    const r = openStore(fs, '/w');
    expect(r).toMatchObject({ ok: false, missing: true });
    expect(fs.exists('/w/.prompts')).toBe(false);
  });

  it('initStore creates the version 2 layout, after which openStore succeeds', () => {
    const fs = new MemoryFs({ '/w': null });
    initStore(fs, P);
    expect(fs.isDir('/w/.prompts/items')).toBe(true);
    expect(fs.isDir('/w/.prompts/archive')).toBe(true);
    expect(fs.readFile('/w/.prompts/VERSION')).toBe('2\n');
    expect(fs.readFile('/w/.prompts/settings.txt')).toBe('');
    expect(fs.readFile('/w/.prompts/sort.txt')).toBe('');
    expect(openStore(fs, '/w').ok).toBe(true);
  });

  it('initStore writes a README that names the tool and links to GitHub', () => {
    const fs = new MemoryFs({ '/w': null });
    initStore(fs, P);
    const readme = fs.readFile('/w/.prompts/README.md');
    expect(readme).toContain('prompts');
    expect(readme).toContain('items/');
    expect(readme).toContain('https://github.com/neilmix/prompts');
    expect(readme.endsWith('\n')).toBe(true);
  });

  it('openStore ignores a README in .prompts', () => {
    const fs = storeFs();
    fs.writeFile('/w/.prompts/README.md', '# hi\n');
    expect(openStore(fs, '/w').ok).toBe(true);
  });

  it('refuses a missing directory', () => {
    const fs = new MemoryFs();
    const r = openStore(fs, '/nope');
    expect(r.ok).toBe(false);
  });

  it('treats a .prompts without VERSION as version 0, needing an upgrade', () => {
    const fs = new MemoryFs({ '/w/.prompts/index': null, '/w/.prompts/sort.txt': '' });
    expect(openStore(fs, '/w')).toMatchObject({ ok: false, outdated: true });
  });

  it('treats version 1 as needing an upgrade', () => {
    expect(openStore(storeFs({ VERSION: '1\n' }), '/w')).toMatchObject({ ok: false, outdated: true });
  });

  it('refuses newer and malformed versions', () => {
    expect(openStore(storeFs({ VERSION: '3\n' }), '/w')).toEqual({
      ok: false,
      errors: ['VERSION: .prompts is version 3, newer than this app supports (2); upgrade prompts'],
    });
    expect(openStore(storeFs({ VERSION: 'one\n' }), '/w')).toEqual({ ok: false, errors: ['VERSION: invalid version "one"'] });
  });

  it('reports missing pieces', () => {
    const fs = new MemoryFs({ '/w/.prompts/settings.txt': '', '/w/.prompts/VERSION': '2\n' });
    const r = openStore(fs, '/w');
    expect(r).toEqual({
      ok: false,
      errors: ['items/: missing directory', 'archive/: missing directory', 'sort.txt: missing file'],
    });
  });

  it('loads a valid store, archive included', () => {
    const fs = storeFs({
      'settings.txt': 'editor: nano\n',
      [`items/${A}.md`]: 'tags: x, y\n\n\nbody',
      'archive/20250101-000000.md': 'tags:\n\n\nold text\n',
      'sort.txt': `${A}\n`,
    });
    const r = openStore(fs, '/w');
    if (!r.ok) throw new Error('errors' in r ? r.errors.join() : 'missing');
    expect(r.store.settings).toEqual({ editor: 'nano' });
    expect(r.store.prompts.get(A)).toEqual({ id: A, tags: ['x', 'y'], text: 'body' });
    expect(r.store.archived.get('20250101-000000')).toEqual({ id: '20250101-000000', tags: [], text: 'old text\n' });
    expect(r.store.sort).toEqual([A]);
  });

  it('collects validation errors from every file', () => {
    const fs = storeFs({
      'settings.txt': 'color: red\n',
      [`items/${A}.md`]: 'tags: x\n\n\n \n\n',
      'items/bad.md': 'tags:\n\n\nx',
      'items/20260101-000002.txt': 'tags:\n\n\nx',
      'items/20260101-000001.md': 'tags:\nextra: 1\n\n\nx',
      'items/20260101-000003.md': 'tags:\n\none blank line only\n',
      'items/20260101-000004.md': 'title: old\n\n\nx',
      'items/20260101-000005.md': 'tags:\n\n\nx',
      'archive/20260101-000005.md': 'tags:\n\n\ndup',
      'archive/20250101-000000.md': 'nope\n',
      'sort.txt': 'junk\n',
    });
    const r = openStore(fs, '/w');
    expect(r).toEqual({
      ok: false,
      errors: [
        'settings.txt: unknown key "color"',
        `items/${A}.md: empty text`,
        'items/20260101-000001.md: unknown key "extra"',
        'items/20260101-000002.txt: unexpected file',
        'items/20260101-000003.md: expected two empty lines after the header',
        'items/20260101-000004.md: unknown key "title"',
        'items/bad.md: invalid id',
        'archive/20250101-000000.md: line 1: expected "key: value"',
        'sort.txt: line 1: invalid id "junk"',
        'archive/20260101-000005.md: same id as items/20260101-000005.md',
      ],
    });
  });
});

describe('upgradeStore', () => {
  const v0 = (files: Record<string, string> = {}) =>
    new MemoryFs({
      '/w/.prompts/index': null,
      '/w/.prompts/text': null,
      '/w/.prompts/settings.txt': 'editor: vim\n',
      '/w/.prompts/sort.txt': `${A}\n`,
      '/w/.prompts/README.md': README_V0,
      ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
    });

  it('merges index and text files into items, title first in the text, and writes VERSION', () => {
    const fs = v0({
      [`index/${A}.txt`]: 'title: A\ntags: x, y\n',
      [`text/${A}.txt`]: 'body\n\n\nmore',
      'index/20260101-000001.txt': 'title: No text\n',
    });
    expect(upgradeStore(fs, P)).toEqual({ ok: true });
    expect(fs.readFile(`/w/.prompts/items/${A}.md`)).toBe('tags: x, y\n\n\nA\n\nbody\n\n\nmore');
    expect(fs.readFile('/w/.prompts/items/20260101-000001.md')).toBe('tags:\n\n\nNo text\n');
    expect(fs.readFile('/w/.prompts/VERSION')).toBe('2\n');
    expect(fs.isDir('/w/.prompts/archive')).toBe(true);
    expect(fs.exists('/w/.prompts/index')).toBe(false);
    expect(fs.exists('/w/.prompts/text')).toBe(false);
    expect(fs.readFile('/w/.prompts/README.md')).toBe(README);
    const r = openStore(fs, '/w');
    if (!r.ok) throw new Error('errors' in r ? r.errors.join() : 'not ok');
    expect(r.store.prompts.get(A)?.text).toBe('A\n\nbody\n\n\nmore');
    expect(r.store.settings).toEqual({ editor: 'vim' });
    expect(r.store.sort).toEqual([A]);
  });

  it('keeps an edited README and orphan text files', () => {
    const fs = v0({ 'README.md': 'mine\n', [`text/${A}.txt`]: 'orphan' });
    expect(upgradeStore(fs, P)).toEqual({ ok: true });
    expect(fs.readFile('/w/.prompts/README.md')).toBe('mine\n');
    expect(fs.readFile(`/w/.prompts/text/${A}.txt`)).toBe('orphan');
    expect(openStore(fs, '/w').ok).toBe(true);
  });

  it('creates missing pieces of a sparse version 0 store', () => {
    const fs = new MemoryFs({ '/w/.prompts/index': null });
    expect(upgradeStore(fs, P)).toEqual({ ok: true });
    expect(openStore(fs, '/w').ok).toBe(true);
  });

  it('changes nothing when an index file is invalid', () => {
    const fs = v0({ [`index/${A}.txt`]: 'tags: x\n', 'index/junk.md': '' });
    const before = new Map(fs.files);
    expect(upgradeStore(fs, P)).toEqual({
      ok: false,
      errors: [`index/${A}.txt: missing title`, 'index/junk.md: not a prompt index file'],
    });
    expect(fs.files).toEqual(before);
  });

  const v1 = (files: Record<string, string> = {}) =>
    storeFs({ VERSION: '1\n', 'README.md': README_V1, ...files });

  it('version 1: moves each title to the top of its text, archive included', () => {
    const fs = v1({
      [`items/${A}.md`]: 'title: Alpha\ntags: x\n\n\nbody\n',
      'items/20260101-000001.md': 'title: Empty\n\n\n',
      'archive/20250101-000000.md': 'title: Old\n\n\nold',
    });
    expect(upgradeStore(fs, P)).toEqual({ ok: true });
    expect(fs.readFile(`/w/.prompts/items/${A}.md`)).toBe('tags: x\n\n\nAlpha\n\nbody\n');
    expect(fs.readFile('/w/.prompts/items/20260101-000001.md')).toBe('tags:\n\n\nEmpty\n');
    expect(fs.readFile('/w/.prompts/archive/20250101-000000.md')).toBe('tags:\n\n\nOld\n\nold');
    expect(fs.readFile('/w/.prompts/VERSION')).toBe('2\n');
    expect(fs.readFile('/w/.prompts/README.md')).toBe(README);
    const r = openStore(fs, '/w');
    if (!r.ok) throw new Error('errors' in r ? r.errors.join() : 'not ok');
    expect(titleOf(r.store.prompts.get(A)!.text)).toBe('Alpha');
  });

  it('version 1: skips files already converted, so an interrupted upgrade can be rerun', () => {
    const fs = v1({ [`items/${A}.md`]: 'tags:\n\n\nAlpha\n', 'items/20260101-000001.md': 'title: B\n\n\n' });
    expect(upgradeStore(fs, P)).toEqual({ ok: true });
    expect(fs.readFile(`/w/.prompts/items/${A}.md`)).toBe('tags:\n\n\nAlpha\n');
    expect(fs.readFile('/w/.prompts/items/20260101-000001.md')).toBe('tags:\n\n\nB\n');
  });

  it('version 1: changes nothing when a file is invalid', () => {
    const fs = v1({
      [`items/${A}.md`]: 'title: ok\n\n\nx',
      'items/20260101-000001.md': 'title: \n\n\nx',
      'archive/20250101-000000.md': 'title: x\nextra: 1\n',
      'archive/junk.md': 'title: x\n',
    });
    const before = new Map(fs.files);
    expect(upgradeStore(fs, P)).toEqual({
      ok: false,
      errors: [
        'items/20260101-000001.md: missing title',
        'archive/20250101-000000.md: unknown key "extra"',
        'archive/junk.md: invalid id',
      ],
    });
    expect(fs.files).toEqual(before);
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

describe('item files', () => {
  it('parse: header, two empty lines, then the text verbatim', () => {
    expect(parseItem('tags: a\n\n\nline\n\n\nend')).toEqual({ header: { tags: 'a' }, text: 'line\n\n\nend' });
    expect(parseItem('\n\nno header')).toEqual({ header: {}, text: 'no header' });
    expect(parseItem('')).toEqual({ header: {}, text: '' });
    expect(parseItem('title: T\n\n\n')).toEqual({ header: { title: 'T' }, text: '' });
    expect(parseItem('title: T\n\n')).toEqual({ header: { title: 'T' }, text: '' });
    expect(parseItem('title: T\n')).toEqual({ header: { title: 'T' }, text: '' });
    expect(parseItem('title: T')).toEqual({ header: { title: 'T' }, text: '' });
    expect(parseItem('title: T\n\n\n\nstarts blank')).toEqual({ header: { title: 'T' }, text: '\nstarts blank' });
    expect(() => parseItem('title: T\n\ntext')).toThrow('expected two empty lines after the header');
  });

  it('serializes tags, empty when none', () => {
    expect(serializeItem({ id: A, tags: [], text: 'x' })).toBe('tags:\n\n\nx');
    expect(serializeItem({ id: A, tags: ['a', 'b c'], text: 'x\n' })).toBe('tags: a, b c\n\n\nx\n');
  });
});

describe('titleOf', () => {
  it('is the first sentence or the first line, whichever ends first', () => {
    expect(titleOf('Fix the bug. Then test it.')).toBe('Fix the bug.');
    expect(titleOf('Why? Because.')).toBe('Why?');
    expect(titleOf('Stop! Now')).toBe('Stop!');
    expect(titleOf('Line one\nline two. More')).toBe('Line one');
    expect(titleOf('Ends with a period.\nNext')).toBe('Ends with a period.');
    expect(titleOf('Windows\r\nline')).toBe('Windows');
  });

  it('does not end at punctuation without whitespace after it', () => {
    expect(titleOf('See v1.2 and e.g.x for node.js')).toBe('See v1.2 and e.g.x for node.js');
    expect(titleOf('Wait...really? yes')).toBe('Wait...really?');
  });

  it('skips leading blank lines, trims, and turns tabs into spaces', () => {
    expect(titleOf('\n  \n\t Indented\ttitle  \nbody')).toBe('Indented title');
    expect(titleOf('')).toBe('');
    expect(titleOf(' \n\t\n')).toBe('');
  });
});

describe('prompts', () => {
  it('creates with id from clock, tags, text, and collision suffix', () => {
    const fs = storeFs();
    const now = new Date(2026, 8, 21, 14, 30, 5);
    const a = createPrompt(fs, P, 'Hello\n', new Set(), now, ['a', 'b']);
    expect(a).toEqual({ id: '20260921-143005', tags: ['a', 'b'], text: 'Hello\n' });
    expect(fs.readFile(P.itemFile(a.id))).toBe('tags: a, b\n\n\nHello\n');
    const b = createPrompt(fs, P, 'B', new Set([a.id]), now);
    expect(b.id).toBe('20260921-143005-2');
    expect(fs.readFile(P.itemFile(b.id))).toBe('tags:\n\n\nB');
  });

  it('round-trips tags', () => {
    const fs = storeFs();
    savePrompt(fs, P, { id: A, tags: ['a', 'b c'], text: 'x' });
    expect(loadPrompts(fs, P, 'items').value.get(A)?.tags).toEqual(['a', 'b c']);
  });

  it('updates the copy on disk, keeping what changed there since loading', () => {
    const fs = storeFs({ [`items/${A}.md`]: 'tags:\n\n\nnewer text' });
    const loaded = { id: A, tags: [], text: 'old' };
    expect(updatePrompt(fs, P, loaded, { tags: ['t'] })).toEqual({ id: A, tags: ['t'], text: 'newer text' });
    expect(fs.readFile(P.itemFile(A))).toBe('tags: t\n\n\nnewer text');
    fs.writeFile(P.itemFile(A), 'broken');
    expect(updatePrompt(fs, P, loaded, { text: 'x' })).toEqual({ ...loaded, text: 'x' });
    fs.unlink(P.itemFile(A));
    expect(updatePrompt(fs, P, loaded, { tags: ['z'] })).toEqual({ ...loaded, tags: ['z'] });
  });

  it('archives and restores by moving the file', () => {
    const fs = storeFs({ [`items/${A}.md`]: 'tags:\n\n\nx' });
    archivePrompt(fs, P, A);
    expect(fs.exists(P.itemFile(A))).toBe(false);
    expect(fs.readFile(P.archiveFile(A))).toBe('tags:\n\n\nx');
    restorePrompt(fs, P, A);
    expect(fs.readFile(P.itemFile(A))).toBe('tags:\n\n\nx');
    expect(fs.exists(P.archiveFile(A))).toBe(false);
  });

  it('refuses to restore over an existing item', () => {
    const fs = storeFs({ [`items/${A}.md`]: 'tags:\n\n\nT', [`archive/${A}.md`]: 'tags:\n\n\nU' });
    expect(() => restorePrompt(fs, P, A)).toThrow(`items/${A}.md already exists`);
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
    expect(moveInOrder(full, ['a', 'c'], 'c', -1)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveInOrder(full, ['a', 'c'], 'a', 1)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(full, full, 'b', 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveInOrder(full, full, 'a', -1)).toBeNull();
    expect(moveInOrder(full, full, 'd', 1)).toBeNull();
    expect(moveInOrder(full, ['a'], 'a', 1)).toBeNull();
    expect(moveInOrder(full, full, 'a', 0)).toBeNull();
  });

  it('moves several steps and clamps at the ends', () => {
    const full = ['a', 'b', 'c', 'd'];
    expect(moveInOrder(full, full, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(full, full, 'a', 10)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveInOrder(full, full, 'd', -10)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveInOrder(full, ['b', 'd'], 'b', 5)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveInOrder(full, ['b', 'd'], 'd', -5)).toEqual(['a', 'd', 'b', 'c']);
  });
});
