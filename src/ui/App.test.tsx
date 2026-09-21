import { afterEach, describe, expect, it } from 'vitest';
import { mount, plain, type Harness } from '../test/harness.jsx';
import { KEYS } from '../test/keys.js';

const A = '20260101-000001';
const B = '20260101-000002';
const C = '20260101-000003';

const THREE = {
  [`index/${A}.txt`]: 'title: Alpha\ntags: work, Urgent\n',
  [`index/${B}.txt`]: 'title: Beta\ntags: work\n',
  [`index/${C}.txt`]: 'title: Gamma\n',
  [`text/${B}.txt`]: 'line one\nline two\n',
};

let h: Harness;
afterEach(() => h?.unmount());

const lines = () => plain(h.frame()).split('\n');
/** Rows rendered inverse (selected). */
const highlighted = () =>
  [...h.frame().matchAll(/\x1b\[7m(.*?)\x1b\[27m/g)].map((m) => plain(m[1]!).trim()).filter((s) => s !== '');
/** Highlighted list rows, excluding the selected button. */
const selectedRows = () => highlighted().slice(0, -1);

describe('list view', () => {
  it('shows "no prompts" when empty', async () => {
    h = await mount();
    expect(lines()[0]).toBe('no prompts');
  });

  it('lists newest first with blank lines between and selects the first', async () => {
    h = await mount(THREE);
    expect(lines().slice(0, 5)).toEqual(['Gamma', '', 'Beta', '', 'Alpha']);
    expect(selectedRows()).toEqual(['Gamma']);
  });

  it('honors sort.txt with unlisted items first', async () => {
    h = await mount({ ...THREE, 'sort.txt': `${A}\n${C}\n` });
    expect(lines().slice(0, 5)).toEqual(['Beta', '', 'Alpha', '', 'Gamma']);
  });

  it('moves selection with arrows, paging, home/end, and clamps', async () => {
    h = await mount(THREE);
    await h.press(KEYS.down);
    expect(selectedRows()).toEqual(['Beta']);
    expect(lines()[9]).toBe('work');
    await h.press(KEYS.down, KEYS.down);
    expect(selectedRows()).toEqual(['Alpha']);
    await h.press(KEYS.ctrlShiftUp);
    expect(selectedRows()).toEqual(['Gamma']);
    await h.press(KEYS.end);
    expect(selectedRows()).toEqual(['Alpha']);
    await h.press(KEYS.home);
    expect(selectedRows()).toEqual(['Gamma']);
    await h.press(KEYS.ctrlDown);
    expect(selectedRows()).toEqual(['Alpha']);
    await h.press(KEYS.ctrlUp);
    expect(selectedRows()).toEqual(['Gamma']);
  });

  it('scrolls to keep the selection visible and wraps long titles', async () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 6; i++) files[`index/20260101-00000${i}.txt`] = `title: Item ${i} has a long title\n`;
    h = await mount(files, { rows: 8, columns: 14 });
    expect(lines().slice(0, 4)).toEqual(['Item 6 has a', 'long title', '', 'Item 5 has a']);
    await h.press(KEYS.down);
    expect(selectedRows()).toEqual(['Item 5 has a', 'long title']);
    expect(lines().slice(0, 4)).toEqual(['long title', '', 'Item 5 has a', 'long title']);
    await h.press(KEYS.end);
    expect(selectedRows()).toEqual(['Item 1 has a', 'long title']);
    await h.press(KEYS.home);
    expect(lines()[0]).toBe('Item 6 has a');
  });

  it('reorders with shift+arrows and writes sort.txt', async () => {
    h = await mount(THREE);
    await h.press(KEYS.shiftDown);
    expect(lines().slice(0, 5)).toEqual(['Beta', '', 'Gamma', '', 'Alpha']);
    expect(selectedRows()).toEqual(['Gamma']);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${B}\n${C}\n${A}\n`);
    await h.press(KEYS.shiftDown, KEYS.shiftDown);
    expect(lines().slice(0, 5)).toEqual(['Beta', '', 'Alpha', '', 'Gamma']);
    await h.press(KEYS.shiftUp, KEYS.shiftUp);
    expect(lines().slice(0, 5)).toEqual(['Gamma', '', 'Beta', '', 'Alpha']);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${C}\n${B}\n${A}\n`);
  });

  it('cycles buttons with tab and activates with enter, not space', async () => {
    h = await mount(THREE);
    expect(highlighted()).toEqual(['Gamma', 'New']);
    await h.press(KEYS.tab);
    expect(highlighted()).toEqual(['Gamma', 'Open']);
    await h.press(KEYS.space);
    expect(lines()[0]).toBe('Gamma');
    await h.press(KEYS.enter);
    expect(lines()[0]).toBe(' Gamma');
    await h.press(KEYS.escape);
    for (let i = 0; i < 7; i++) await h.press(KEYS.tab);
    expect(highlighted()).toEqual(['Gamma', 'New']);
  });
});

describe('New', () => {
  it('creates a prompt, selects it, and puts it first', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('n'));
    expect(lines()[0]).toBe(' New prompt');
    await h.press('N', 'e', 'w', KEYS.space, 'o', 'n', 'e', KEYS.enter);
    expect(lines().slice(0, 3)).toEqual(['New one', '', 'Gamma']);
    expect(highlighted()).toEqual(['New one', 'New']);
    expect(h.fs.readFile('/w/.prompts/index/20260921-143005.txt')).toBe('title: New one\n');
    expect(h.fs.readFile('/w/.prompts/text/20260921-143005.txt')).toBe('');
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`20260921-143005\n${C}\n${B}\n${A}\n`);
  });

  it('ignores empty titles and cancels with escape', async () => {
    h = await mount();
    await h.press(KEYS.ctrl('n'), KEYS.space, KEYS.enter);
    expect(lines()[0]).toBe(' New prompt');
    await h.press(KEYS.escape);
    expect(lines()[0]).toBe('no prompts');
  });

  it('edits text with cursor keys', async () => {
    h = await mount();
    await h.press(KEYS.ctrl('n'), 'a', 'c', KEYS.left, 'b', KEYS.end, 'd', KEYS.home, KEYS.delete, KEYS.end, KEYS.backspace, KEYS.enter);
    expect(lines()[0]).toBe('bc');
  });
});

describe('Open', () => {
  it('shows title, text, tags and scrolls', async () => {
    h = await mount(THREE, { rows: 8 });
    await h.press(KEYS.down, KEYS.ctrl('o'));
    expect(lines().slice(0, 3)).toEqual([' Beta', 'line one', 'line two']);
    expect(lines()[5]).toBe('work');
    expect(lines()[7]).toBe('Edit  Title  Back');
    h.unmount();
    h = await mount(THREE, { rows: 6 });
    await h.press(KEYS.down, KEYS.ctrl('o'));
    expect(lines().slice(1, 2)).toEqual(['line one']);
    await h.press(KEYS.down);
    expect(lines().slice(1, 2)).toEqual(['line two']);
    await h.press(KEYS.down);
    expect(lines().slice(1, 2)).toEqual(['line two']);
    await h.press(KEYS.home);
    expect(lines().slice(1, 2)).toEqual(['line one']);
  });

  it('shows "empty" for no text', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('o'));
    expect(lines()[1]).toBe('empty');
  });

  it('runs the editor and reloads the text', async () => {
    h = await mount(THREE, { env: { EDITOR: 'nano -w' } });
    await h.press(KEYS.ctrl('o'), KEYS.ctrl('e'));
    expect(h.edits).toEqual([`nano -w /w/.prompts/text/${C}.txt`]);
    expect(lines()[1]).toBe('edited');
  });

  it('prefers the editor setting', async () => {
    h = await mount({ ...THREE, 'settings.txt': 'editor: code --wait\n' }, { env: { EDITOR: 'nano' } });
    await h.press(KEYS.ctrl('o'), KEYS.ctrl('e'));
    expect(h.edits).toEqual([`code --wait /w/.prompts/text/${C}.txt`]);
  });

  it('renames via Title and returns with Back', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('o'), KEYS.ctrl('t'));
    expect(lines()[9]).toBe('Title: Gamma');
    await h.press(KEYS.backspace, KEYS.backspace, 'y', KEYS.enter);
    expect(lines()[0]).toBe(' Gamy');
    expect(h.fs.readFile(`/w/.prompts/index/${C}.txt`)).toBe('title: Gamy\n');
    await h.press(KEYS.ctrl('b'));
    expect(lines()[0]).toBe('Gamy');
  });

  it('title escape cancels without saving', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('o'), KEYS.ctrl('t'), 'x', KEYS.escape);
    expect(lines()[0]).toBe(' Gamma');
    expect(lines()[11]).toBe('Edit  Title  Back');
  });
});

describe('Complete and Leave', () => {
  it('toggles the checkbox and marker, deletes on leave', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('c'));
    expect(lines()[0]).toBe('✓ Gamma');
    expect(lines()[11]).toContain('[x] Complete');
    await h.press(KEYS.ctrl('c'));
    expect(lines()[0]).toBe('Gamma');
    expect(lines()[11]).toContain('[ ] Complete');
    await h.press(KEYS.ctrl('c'), KEYS.down);
    expect(lines()[11]).toContain('[ ] Complete');
    await h.press(KEYS.ctrl('l'));
    expect(h.fs.exists(`/w/.prompts/index/${C}.txt`)).toBe(false);
    expect(h.fs.exists(`/w/.prompts/text/${C}.txt`)).toBe(false);
    expect(h.fs.exists(`/w/.prompts/index/${B}.txt`)).toBe(true);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${B}\n${A}\n`);
  });

  it('leave without completed items leaves files alone', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('l'));
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe('');
    expect(h.fs.exists(`/w/.prompts/index/${C}.txt`)).toBe(true);
  });
});

describe('Tag', () => {
  it('lists tags, adds with autocomplete, removes, and saves', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('t'));
    expect(lines().slice(0, 2)).toEqual([' Gamma', 'no tags']);
    await h.press(KEYS.ctrl('a'), 'u');
    expect(lines()[9]).toBe('Tag: urgent');
    await h.press(KEYS.tab, KEYS.enter);
    expect(lines()[1]).toBe('Urgent');
    expect(h.fs.readFile(`/w/.prompts/index/${C}.txt`)).toBe('title: Gamma\ntags: Urgent\n');
    await h.press(KEYS.ctrl('a'), 'W', 'O', 'R', 'K', KEYS.enter);
    expect(lines().slice(1, 3)).toEqual(['Urgent', 'work']);
    await h.press(KEYS.ctrl('a'), 'n', 'e', 'w', KEYS.enter);
    expect(lines().slice(1, 4)).toEqual(['Urgent', 'work', 'new']);
    await h.press(KEYS.down, KEYS.ctrl('r'));
    expect(lines().slice(1, 4)).toEqual(['Urgent', 'new', '']);
    expect(h.fs.readFile(`/w/.prompts/index/${C}.txt`)).toBe('title: Gamma\ntags: Urgent, new\n');
    await h.press(KEYS.escape);
    expect(lines()[9]).toBe('Urgent  new');
  });

  it('rejects commas and duplicates', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('t'), KEYS.ctrl('a'), 'a', ',', 'b', KEYS.enter);
    expect(lines()[11]).toBe('tags may not contain commas');
    await h.press(KEYS.ctrl('a'), 'x', KEYS.enter, KEYS.ctrl('a'), 'X', KEYS.enter);
    expect(lines().slice(1, 3)).toEqual(['x', '']);
  });

  it('right arrow accepts completion only at the end', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('t'), KEYS.ctrl('a'), 'w', KEYS.right, KEYS.enter);
    expect(lines()[1]).toBe('work');
  });
});

describe('Filter', () => {
  it('filters with AND, shows header, clears', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('f'));
    expect(lines().slice(0, 3)).toEqual([' Filter tags', '[ ] Urgent', '[ ] work']);
    await h.press(KEYS.down, KEYS.space, KEYS.escape);
    expect(lines().slice(0, 4)).toEqual(['Filter: work', 'Beta', '', 'Alpha']);
    await h.press(KEYS.ctrl('f'), KEYS.space, KEYS.ctrl('b'));
    expect(lines().slice(0, 2)).toEqual(['Filter: work, Urgent', 'Alpha']);
    await h.press(KEYS.ctrl('f'), KEYS.ctrl('c'), KEYS.enter);
    expect(lines()[0]).toBe('Gamma');
  });

  it('enter does not toggle', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('f'), KEYS.enter);
    expect(lines()[0]).toBe('Gamma');
  });

  it('keeps reordering inside the filtered list', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('f'), KEYS.down, KEYS.space, KEYS.escape, KEYS.shiftDown);
    expect(lines().slice(1, 4)).toEqual(['Alpha', '', 'Beta']);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${C}\n${A}\n${B}\n`);
  });
});

describe('Settings', () => {
  it('edits the editor setting', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('s'));
    expect(lines().slice(0, 2)).toEqual([' Settings', 'editor:']);
    await h.press(KEYS.ctrl('e'), 'v', 'i', 'm', KEYS.enter);
    expect(lines()[1]).toBe('editor: vim');
    expect(h.fs.readFile('/w/.prompts/settings.txt')).toBe('editor: vim\n');
    await h.press(KEYS.enter, KEYS.backspace, KEYS.backspace, KEYS.backspace, KEYS.enter);
    expect(h.fs.readFile('/w/.prompts/settings.txt')).toBe('');
    await h.press(KEYS.escape);
    expect(lines()[0]).toBe('Gamma');
  });
});

describe('errors', () => {
  it('shows write failures in the command pane until the next key', async () => {
    h = await mount(THREE);
    h.fs.writeFile = () => {
      throw new Error('disk full');
    };
    await h.press(KEYS.shiftDown);
    expect(lines()[11]).toBe('disk full');
    await h.press(KEYS.down);
    expect(lines()[11]).toContain('New');
  });
});
