import { describe, expect, it } from 'vitest';
import * as ops from './ops.js';
import { MemoryFs } from './store/fs.js';
import { openStore, type Store } from './store/open.js';

const A = '20260101-000001';
const B = '20260101-000002';
const C = '20260101-000003';
const OLD = '20250101-000000';

function setup(): { fs: MemoryFs; store: Store } {
  const fs = new MemoryFs({
    '/w/.prompts/VERSION': '2\n',
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': `${C}\n${B}\n${A}\n`,
    [`/w/.prompts/items/${A}.md`]: 'tags: Work\n\n\nalpha',
    [`/w/.prompts/items/${B}.md`]: 'tags:\n\n\nBeta',
    [`/w/.prompts/items/${C}.md`]: 'tags:\n\n\nGamma',
    [`/w/.prompts/archive/${OLD}.md`]: 'tags: Legacy\n\n\nold',
  });
  const r = openStore(fs, '/w');
  if (!r.ok) throw new Error('not ok');
  return { fs, store: r.store };
}

const read = (fs: MemoryFs, rel: string) => fs.readFile(`/w/.prompts/${rel}`);

describe('ops', () => {
  it('create: canonical tags, first in order, avoids archived ids', () => {
    const { fs, store } = setup();
    const r = ops.create(fs, store.paths, store, { tags: ['work', 'LEGACY', 'x', 'X'], text: 'hi' }, new Date(2025, 0, 1, 0, 0, 0));
    expect(r.prompt).toEqual({ id: `${OLD}-2`, tags: ['Work', 'Legacy', 'x'], text: 'hi' });
    expect(r.sort).toEqual([`${OLD}-2`, C, B, A]);
    expect(read(fs, 'sort.txt')).toBe(`${OLD}-2\n${C}\n${B}\n${A}\n`);
  });

  it('create and writeText refuse blank text without writing', () => {
    const { fs, store } = setup();
    const before = new Map(fs.files);
    expect(() => ops.create(fs, store.paths, store, { text: ' \n\t' }, new Date())).toThrow('text is empty');
    expect(() => ops.writeText(fs, store.paths, store, A, '\n')).toThrow('text is empty');
    expect(fs.files).toEqual(before);
  });

  it('add, remove and set tags, write text', () => {
    const { fs, store } = setup();
    expect(ops.addTags(fs, store.paths, store, A, ['WORK', 'new']).tags).toEqual(['Work', 'new']);
    expect(ops.removeTags(fs, store.paths, store, A, ['work', 'absent']).tags).toEqual([]);
    expect(ops.setTags(fs, store.paths, store, B, ['work', 'z']).tags).toEqual(['Work', 'z']);
    expect(ops.writeText(fs, store.paths, store, B, 'body').text).toBe('body');
    expect(read(fs, `items/${B}.md`)).toBe('tags: Work, z\n\n\nbody');
  });

  it('moveTo a 1-based position, clamped; null when unchanged', () => {
    const { fs, store } = setup();
    expect(ops.moveTo(fs, store.paths, store, A, 1)).toEqual([A, C, B]);
    expect(ops.moveTo(fs, store.paths, store, C, 99)).toEqual([B, A, C]);
    expect(ops.moveTo(fs, store.paths, store, C, 1)).toBeNull();
    expect(read(fs, 'sort.txt')).toBe(`${B}\n${A}\n${C}\n`);
  });

  it('archive moves files and drops them from the order', () => {
    const { fs, store } = setup();
    const r = ops.archive(fs, store.paths, store, [A, C]);
    expect(r).toEqual({ archived: [A, C], sort: [B], error: null });
    expect(read(fs, `archive/${A}.md`)).toBe('tags: Work\n\n\nalpha');
    expect(fs.exists(`/w/.prompts/items/${A}.md`)).toBe(false);
    expect(read(fs, 'sort.txt')).toBe(`${B}\n`);
  });

  it('archive stops at the first failure and keeps what moved', () => {
    const { fs, store } = setup();
    fs.unlink(`/w/.prompts/items/${C}.md`);
    const r = ops.archive(fs, store.paths, store, [A, C, B]);
    expect(r.archived).toEqual([A]);
    expect(r.error?.message).toMatch(/ENOENT/);
    expect(read(fs, 'sort.txt')).toBe(`${C}\n${B}\n`);
  });

  it('restore moves the file back, first in order', () => {
    const { fs, store } = setup();
    const r = ops.restore(fs, store.paths, store, OLD);
    expect(r.prompt.text).toBe('old');
    expect(r.sort).toEqual([OLD, C, B, A]);
    expect(read(fs, `items/${OLD}.md`)).toBe('tags: Legacy\n\n\nold');
    expect(fs.exists(`/w/.prompts/archive/${OLD}.md`)).toBe(false);
  });
});
