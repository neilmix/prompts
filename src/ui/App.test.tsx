import { afterEach, describe, expect, it } from 'vitest';
import { mount, plain, type Harness } from '../test/harness.js';
import { KEYS } from '../test/keys.js';

const A = '20260101-000001';
const B = '20260101-000002';
const C = '20260101-000003';

const OLD = '20250101-000001';

const THREE = {
  [`items/${A}.md`]: 'title: Alpha\ntags: work, Urgent\n\n\n',
  [`items/${B}.md`]: 'title: Beta\ntags: work\n\n\nline one\nline two\n',
  [`items/${C}.md`]: 'title: Gamma\n\n\n',
};

const WITH_ARCHIVE = {
  ...THREE,
  [`archive/${OLD}.md`]: 'title: Old idea\ntags: legacy\n\n\nold text\n',
  'archive/20250101-000002.md': 'title: Older plan\n\n\n',
};

const item = (id: string) => `/w/.prompts/items/${id}.md`;

// Default harness size is 12 rows by 40 columns.
// List view rows: 0-9 list, 10 separator (hint, counter), 11 buttons.
const ROW = { buttons: 11, message: 10, input: 9 } as const;

let h: Harness;
afterEach(() => h?.unmount());

const lines = () => plain(h.frame()).split('\n');
const line = (n: number) => lines()[n] ?? '';
/** Text drawn on a blue background (the focused body selection). */
const focusedRow = () => {
  const m = /\x1b\[44m(.*?)\x1b\[49m/.exec(h.frame());
  return m ? plain(m[1]!) : null;
};
/** Text drawn on a magenta background (the item being moved). */
const movingRow = () => {
  const m = /\x1b\[45m(.*?)\x1b\[49m/.exec(h.frame());
  return m ? plain(m[1]!) : null;
};
/** Text drawn inverse, excluding the title bar (the focused button). */
const mouse = (button: number, x: number, y: number) => `\x1b[<${button};${x + 1};${y + 1}M`;
const focusedButton = () => {
  const found = [...h.frame().matchAll(/\x1b\[7m(.*?)\x1b\[27m/g)].map((m) => plain(m[1]!).trim());
  return found.filter((s) => !s.includes('›') && !/^(New prompt|Settings|Archive\b.*archived$)/.test(s))[0] ?? null;
};

describe('list view', () => {
  it('shows a hint when empty', async () => {
    h = await mount();
    expect(line(0)).toBe('no prompts · n to create one');
    expect(line(ROW.message)).toMatch(/^─+$/);
  });

  it('centers a reorder hint on the separator above the buttons, changing in move mode', async () => {
    h = await mount(THREE);
    expect(line(ROW.message)).toBe('──────── press space to reorder ────────');
    await h.press(KEYS.space);
    expect(line(ROW.message)).toBe('──── moving · press space when done ────');
    await h.press(KEYS.escape);
    expect(line(ROW.message)).toBe('──────── press space to reorder ────────');
    await h.press('t');
    expect(line(ROW.message)).toMatch(/^─+$/);
  });

  it('lists newest first, single spaced, with a gutter marker on the focused selection', async () => {
    h = await mount(THREE);
    expect(lines().slice(0, 3)).toEqual(['▸ • Gamma', '  • Beta [work]', '  • Alpha [work] [Urgent]']);
    expect(focusedRow()).toBe('• Gamma');
    expect(focusedButton()).toBeNull();
    expect(line(ROW.buttons)).toBe('New  Open  Copy  /Search  Archive  Tag');
  });

  it('honors sort.txt with unlisted items first', async () => {
    h = await mount({ ...THREE, 'sort.txt': `${A}\n${C}\n` });
    expect(lines().slice(0, 3)).toEqual(['▸ • Beta [work]', '  • Alpha [work] [Urgent]', '  • Gamma']);
  });

  it('moves selection with arrows, vim keys, paging, home/end', async () => {
    h = await mount(THREE);
    await h.press(KEYS.down);
    expect(focusedRow()).toBe('• Beta [work]');
    await h.press('j', 'j');
    expect(focusedRow()).toBe('• Alpha [work] [Urgent]');
    await h.press('k');
    expect(focusedRow()).toBe('• Beta [work]');
    await h.press(KEYS.home);
    expect(focusedRow()).toBe('• Gamma');
    await h.press(KEYS.end);
    expect(focusedRow()).toBe('• Alpha [work] [Urgent]');
    await h.press('g');
    expect(focusedRow()).toBe('• Gamma');
    await h.press('G');
    expect(focusedRow()).toBe('• Alpha [work] [Urgent]');
    await h.press(KEYS.home, KEYS.pageDown);
    expect(focusedRow()).toBe('• Alpha [work] [Urgent]');
    await h.press(KEYS.pageUp);
    expect(focusedRow()).toBe('• Gamma');
  });

  it('wraps long titles under the gutter and shows a range counter when overflowing', async () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 6; i++) files[`items/20260101-00000${i}.md`] = `title: Item ${i} has a long title that wraps around\n`;
    h = await mount(files, { rows: 10 });
    expect(lines().slice(0, 4)).toEqual(['▸ • Item 6 has a long title that wraps', '    around', '  • Item 5 has a long title that wraps', '    around']);
    expect(line(8)).toBe('── press space to reorder ── 1–8 of 12 ─');
    await h.press(KEYS.end);
    expect(lines().slice(0, 2)).toEqual(['  • Item 4 has a long title that wraps', '    around']);
    expect(line(8)).toBe('─ press space to reorder ── 5–12 of 12 ─');
  });

  it('draws tags after the title in cyan, wrapping with the title', async () => {
    h = await mount({ [`items/${A}.md`]: 'title: A title that is fairly long\ntags: alpha, beta, gamma\n' });
    expect(lines().slice(0, 2)).toEqual(['▸ • A title that is fairly long [alpha]', '    [beta] [gamma]']);
    expect(h.frame()).toContain('\x1b[36m[alpha]');
    expect(h.frame()).toContain('\x1b[36m[beta] [gamma]');
  });

  it('space enters move mode: arrows reorder and write sort.txt; space leaves it', async () => {
    h = await mount(THREE);
    await h.press(KEYS.space);
    expect(lines()[0]).toBe('↕ • Gamma');
    expect(movingRow()).toBe('• Gamma');
    await h.press(KEYS.down);
    expect(lines().slice(0, 3)).toEqual(['  • Beta [work]', '↕ • Gamma', '  • Alpha [work] [Urgent]']);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${B}\n${C}\n${A}\n`);
    await h.press(KEYS.down, KEYS.down);
    expect(lines().slice(0, 3)).toEqual(['  • Beta [work]', '  • Alpha [work] [Urgent]', '↕ • Gamma']);
    await h.press('k', 'k');
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${C}\n${B}\n${A}\n`);
    await h.press(KEYS.space);
    expect(lines()[0]).toBe('▸ • Gamma');
    expect(movingRow()).toBeNull();
    expect(focusedRow()).toBe('• Gamma');
    await h.press(KEYS.down);
    expect(focusedRow()).toBe('• Beta [work]');
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${C}\n${B}\n${A}\n`);
  });

  it('move mode: paging, home/end and g/G move the item; Escape leaves', async () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 6; i++) files[`items/20260101-00000${i}.md`] = `title: Item ${i}\n`;
    h = await mount(files, { rows: 12 });
    // 8 body rows, 6 items: a page is 8 and clamps at the ends.
    await h.press(KEYS.space, KEYS.end);
    expect(lines().slice(0, 6).map((l) => l.slice(0, 1))).toEqual([' ', ' ', ' ', ' ', ' ', '↕']);
    expect(lines()[5]).toBe('↕ • Item 6');
    await h.press(KEYS.home);
    expect(lines()[0]).toBe('↕ • Item 6');
    await h.press(KEYS.pageDown);
    expect(lines()[5]).toBe('↕ • Item 6');
    await h.press(KEYS.pageUp);
    expect(lines()[0]).toBe('↕ • Item 6');
    await h.press('G');
    expect(lines()[5]).toBe('↕ • Item 6');
    await h.press('g');
    expect(lines()[0]).toBe('↕ • Item 6');
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(
      ['20260101-000006', '20260101-000005', '20260101-000004', '20260101-000003', '20260101-000002', '20260101-000001'].map((id) => `${id}\n`).join(''),
    );
    await h.press(KEYS.escape);
    expect(lines()[0]).toBe('▸ • Item 6');
    // Escape left move mode without clearing anything else; a second Escape is the normal one.
  });

  it('move mode ignores shortcut letters, Enter and focus keys', async () => {
    h = await mount(THREE);
    await h.press(KEYS.space, 'o', KEYS.enter, KEYS.tab, KEYS.right, 'q');
    expect(lines()[0]).toBe('↕ • Gamma');
    expect(focusedButton()).toBeNull();
    expect(line(ROW.buttons)).toContain('New');
  });
});

describe('focus', () => {
  it('moves between body and buttons with left/right/tab and changes the row style', async () => {
    h = await mount(THREE, { columns: 100 });
    await h.press(KEYS.right);
    expect(focusedButton()).toBe('New');
    expect(focusedRow()).toBeNull();
    expect(line(0)).toBe('▸ • Gamma');
    await h.press(KEYS.right, KEYS.right, KEYS.right, KEYS.right);
    expect(focusedButton()).toBe('Archive');
    await h.press(KEYS.left);
    expect(focusedButton()).toBe('/Search');
    await h.press(KEYS.left, KEYS.left, KEYS.left, KEYS.left);
    expect(focusedButton()).toBeNull();
    expect(focusedRow()).toBe('• Gamma');
    for (let i = 0; i < 10; i++) await h.press(KEYS.tab);
    expect(focusedButton()).toBe('Quit');
    await h.press(KEYS.tab);
    expect(focusedButton()).toBeNull();
  });

  it('up/down still move the list while a button has focus', async () => {
    h = await mount(THREE);
    await h.press(KEYS.right, KEYS.down);
    expect(focusedButton()).toBe('New');
    expect(line(1)).toBe('▸ • Beta [work]');
  });

  it('ctrl+letter is not a shortcut', async () => {
    h = await mount(THREE);
    await h.press(KEYS.ctrl('o'));
    expect(line(0)).toBe('▸ • Gamma');
    await h.press(KEYS.ctrl('a'));
    expect(line(0)).toBe('▸ • Gamma');
  });

  it('bare shortcut letters work with any focus; uppercase does not', async () => {
    h = await mount(THREE);
    await h.press(KEYS.right, KEYS.right, 'a');
    expect(line(0)).toBe('▸ • ✓ Gamma');
    await h.press('A');
    expect(line(0)).toBe('▸ • ✓ Gamma');
    await h.press('t');
    expect(line(0)).toMatch(/^ Tags › Gamma/);
  });

  it('enter on the body opens; enter on a button activates it; space never activates a button', async () => {
    h = await mount(THREE);
    await h.press(KEYS.enter);
    expect(line(0)).toMatch(/^ Open › Gamma/);
    await h.press(KEYS.escape, KEYS.right, KEYS.space);
    expect(line(0)).toBe('↕ • Gamma');
    await h.press(KEYS.space, KEYS.enter);
    expect(line(0)).toBe(' New prompt');
  });
});

describe('New', () => {
  it('creates a prompt, puts it first, selects it and opens the editor', async () => {
    h = await mount(THREE, { env: { EDITOR: 'nano -w' } });
    await h.press('n');
    expect(line(0)).toBe(' New prompt');
    await h.press('N', 'e', 'w', KEYS.space, 'o', 'n', 'e', KEYS.enter);
    expect(lines().slice(0, 2)).toEqual(['▸ • New one', '  • Gamma']);
    expect(h.edits).toEqual(['nano -w /tmp/prompts-1/20260921-143005.md']);
    expect(h.fs.readFile(item('20260921-143005'))).toBe('title: New one\n\n\nedited');
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`20260921-143005\n${C}\n${B}\n${A}\n`);
  });

  it('ignores empty titles and cancels with escape', async () => {
    h = await mount();
    await h.press('n', KEYS.space, KEYS.enter);
    expect(line(0)).toBe(' New prompt');
    await h.press(KEYS.escape);
    expect(line(0)).toMatch(/^no prompts/);
    expect(h.edits).toEqual([]);
  });

  it('scrolls a long title to keep the cursor in view, marking hidden text', async () => {
    h = await mount();
    const title = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';
    await h.press('n', title);
    // 40 columns: "Title: " leaves 33 cells. The entry is the last line.
    expect(line(11)).toBe('Title: …lmnopqrstuvwxyz0123456789ABCDEF');
    await h.press(KEYS.home);
    expect(line(11)).toBe('Title: abcdefghijklmnopqrstuvwxyz012345…');
    await h.press(KEYS.end, ...Array(36).fill(KEYS.left));
    expect(line(11)).toBe('Title: …ghijklmnopqrstuvwxyz0123456789A…');
    await h.press(KEYS.enter);
    expect(line(0)).toBe(`▸ • ${title.slice(0, 36)}`);
  });

  it('edits text with cursor keys', async () => {
    h = await mount();
    await h.press('n', 'a', 'c', KEYS.left, 'b', KEYS.end, 'd', KEYS.home, KEYS.delete, KEYS.end, KEYS.backspace, KEYS.enter);
    expect(line(0)).toBe('▸ • bc');
  });
});

describe('Open', () => {
  it('shows breadcrumb, id, text, path and tags', async () => {
    h = await mount(THREE);
    await h.press(KEYS.down, 'o');
    expect(line(0)).toBe(` Open › Beta [work]${' '.repeat(5)}${B}`);
    expect(lines().slice(1, 3)).toEqual(['line one', 'line two']);
    expect(line(9)).toBe(`─ .prompts/items/${B}.md ────`);
    expect(line(11)).toBe('Edit  Retitle  Tag  Copy  Archive  Back');
  });

  it('scrolls with arrows and vim keys and shows a range counter', async () => {
    h = await mount({ ...THREE, [`items/${B}.md`]: 'title: Beta\ntags: work\n\n\na\nb\nc\nd\ne\nf\ng\nh\n' }, { rows: 10 });
    await h.press(KEYS.down, 'o');
    expect(lines().slice(1, 7)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(line(7)).toBe('─ .prompts/items/20260101-… ─ 1–6 of 8 ─');
    await h.press('j');
    expect(lines().slice(1, 7)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
    await h.press('j');
    expect(lines().slice(1, 7)).toEqual(['c', 'd', 'e', 'f', 'g', 'h']);
    await h.press('g');
    expect(line(1)).toBe('a');
    await h.press(KEYS.end);
    expect(line(6)).toBe('h');
  });

  it('shows a hint for empty text and Enter on the body edits', async () => {
    h = await mount(THREE, { env: { EDITOR: 'vi' } });
    await h.press('o');
    expect(line(1)).toBe('empty · e to edit');
    await h.press(KEYS.enter);
    expect(h.edits).toEqual([`vi /tmp/prompts-1/${C}.md`]);
    expect(line(1)).toBe('edited');
    expect(h.fs.readFile(item(C))).toBe('title: Gamma\n\n\nedited');
  });

  it('edits a temp copy of the text only, writes it back, and removes the copy', async () => {
    h = await mount(THREE, { env: { EDITOR: 'vi' }, editorWrites: 'new\n\n\ntext' });
    await h.press(KEYS.down, 'o', 'e');
    expect(h.opened).toEqual(['line one\nline two\n']);
    expect(h.fs.readFile(item(B))).toBe('title: Beta\ntags: work\n\n\nnew\n\n\ntext');
    expect(h.fs.exists('/tmp/prompts-1')).toBe(false);
  });

  it('keeps a retitle made on disk while the editor ran', async () => {
    h = await mount(THREE, { env: { EDITOR: 'vi' } });
    h.fs.writeFile(item(C), 'title: Renamed elsewhere\n\n\n');
    await h.press('o', 'e');
    expect(h.fs.readFile(item(C))).toBe('title: Renamed elsewhere\n\n\nedited');
  });

  it('leaves the file alone when the text did not change', async () => {
    h = await mount(THREE, { env: { EDITOR: 'vi' }, editorWrites: '' });
    const writes: string[] = [];
    const write = h.fs.writeFile.bind(h.fs);
    h.fs.writeFile = (p, t) => {
      writes.push(p);
      write(p, t);
    };
    await h.press('o', 'e');
    expect(writes.filter((p) => p.startsWith('/w/'))).toEqual([]);
    expect(h.edits).toHaveLength(1);
  });

  it('prefers the editor setting and passes the raw shell command', async () => {
    h = await mount({ ...THREE, 'settings.txt': 'editor: code --wait\n' }, { env: { EDITOR: 'nano' } });
    await h.press('o', 'e');
    expect(h.edits).toEqual([`code --wait /tmp/prompts-1/${C}.md`]);
  });

  it('Copy in the list view copies the text, or the title when the text is blank', async () => {
    h = await mount(THREE);
    await h.press('c');
    expect(h.copies).toEqual(['Gamma']);
    expect(line(ROW.message)).toBe('Copied');
    await h.press(KEYS.down, 'c');
    expect(h.copies).toEqual(['Gamma', 'line one\nline two\n']);
    await h.press(KEYS.down, 'o', 'c');
    expect(h.copies).toEqual(['Gamma', 'line one\nline two\n', 'Alpha']);
  });

  it('copies text and reports status; reports clipboard failure', async () => {
    h = await mount(THREE);
    await h.press(KEYS.down, 'o', 'c');
    expect(h.copies).toEqual(['line one\nline two\n']);
    expect(line(ROW.message)).toBe('Copied');
    await h.press(KEYS.down);
    expect(line(ROW.message)).toMatch(/^─+$/);
    h.unmount();
    h = await mount(THREE, { copyFails: true });
    await h.press('o', 'c');
    expect(line(ROW.message)).toBe('no clipboard');
  });

  it('renames via Retitle and returns with Back, q, or escape', async () => {
    h = await mount(THREE);
    await h.press('o', 'r');
    expect(line(ROW.input)).toBe('Title: Gamma');
    await h.press(KEYS.backspace, KEYS.backspace, 'y', KEYS.enter);
    expect(line(0)).toMatch(/^ Open › Gamy/);
    expect(h.fs.readFile(item(C))).toBe('title: Gamy\n\n\n');
    await h.press('b');
    expect(line(0)).toBe('▸ • Gamy');
    await h.press('o', 'q');
    expect(line(0)).toBe('▸ • Gamy');
  });

  it('Retitle turns pasted tabs into spaces', async () => {
    h = await mount(THREE);
    await h.press('o', 'r', 'a\tb', KEYS.enter);
    expect(h.fs.readFile(item(C))).toBe('title: Gammaa b\n\n\n');
  });

  it('title escape cancels without saving', async () => {
    h = await mount(THREE);
    await h.press('o', 'r', 'x', KEYS.escape);
    expect(line(0)).toMatch(/^ Open › Gamma/);
    expect(line(ROW.buttons)).toBe('Edit  Retitle  Tag  Copy  Archive  Back');
  });

  it('Tag opens the Tag view; commit stays there, Back returns to the Open view', async () => {
    h = await mount(THREE);
    await h.press('o', 't');
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    await h.press('a', 'n', 'e', 'w', KEYS.enter);
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    expect(line(1)).toBe('▸ new');
    await h.press('b');
    expect(line(0)).toMatch(/^ Open › Gamma \[new\]/);
    expect(h.fs.readFile(item(C))).toBe('title: Gamma\ntags: new\n\n\n');
    await h.press('t', KEYS.escape);
    expect(line(0)).toMatch(/^ Open › Gamma/);
    await h.press('t', 'b');
    expect(line(0)).toMatch(/^ Open › Gamma/);
    await h.press('t', 'q');
    expect(line(0)).toMatch(/^ Open › Gamma/);
    await h.press('b');
    expect(line(0)).toBe('▸ • Gamma [new]');
  });
});

describe('Archive and Quit', () => {
  it('toggles the mark', async () => {
    h = await mount(THREE);
    await h.press('a');
    expect(line(0)).toBe('▸ • ✓ Gamma');
    expect(line(ROW.buttons)).toContain('✓ Archive');
    await h.press('a');
    expect(line(0)).toBe('▸ • Gamma');
    expect(line(ROW.buttons)).not.toContain('✓');
    await h.press('a', KEYS.down);
    expect(line(ROW.buttons)).not.toContain('✓');
  });

  it('toggles the mark from the Open view', async () => {
    h = await mount(THREE);
    await h.press('o', 'a');
    expect(line(ROW.buttons)).toBe('Edit  Retitle  Tag  Copy  ✓ Archive  Bac');
    await h.press('b');
    expect(line(0)).toBe('▸ • ✓ Gamma');
    expect(line(ROW.buttons)).toContain('✓ Archive');
  });

  it('quits immediately with nothing marked, via q or ^C', async () => {
    for (const k of ['q', KEYS.ctrl('c')]) {
      h = await mount(THREE);
      await h.press(k);
      expect(h.exit()).toEqual({ archived: 0 });
      expect(h.fs.exists(item(C))).toBe(true);
      h.unmount();
    }
  });

  it('moves marked prompts to archive/ on quit without asking', async () => {
    h = await mount(THREE);
    await h.press('a', KEYS.down, 'a', 'o', KEYS.ctrl('c'));
    expect(h.exit()).toEqual({ archived: 2 });
    expect(h.fs.exists(item(C))).toBe(false);
    expect(h.fs.readFile(`/w/.prompts/archive/${B}.md`)).toBe('title: Beta\ntags: work\n\n\nline one\nline two\n');
    expect(h.fs.exists(`/w/.prompts/archive/${C}.md`)).toBe(true);
    expect(h.fs.exists(item(A))).toBe(true);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${A}\n`);
  });

  it('stays open and shows the error when archiving fails', async () => {
    h = await mount(THREE);
    await h.press('a', KEYS.down, 'a');
    h.fs.unlink(item(B));
    await h.press('q');
    expect(h.exit()).toBeUndefined();
    expect(line(ROW.message)).toMatch(/ENOENT/);
    expect(lines().slice(0, 2)).toEqual(['▸ • ✓ Beta [work]', '  • Alpha [work] [Urgent]']);
  });
});

describe('Tag', () => {
  it('opens on the tag list; Add commits, closes the entry and selects the new tag', async () => {
    h = await mount(THREE);
    await h.press('t');
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    expect(line(1)).toBe('no tags · a to add one');
    expect(line(ROW.buttons)).toBe('Add  Remove  Back');
    await h.press('a', 'u');
    expect(line(ROW.input)).toBe('Tag: urgent                Tab completes');
    await h.press(KEYS.tab, KEYS.enter);
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    expect(line(1)).toBe('▸ Urgent');
    expect(line(ROW.input)).not.toMatch(/^Tag:/);
    expect(h.fs.readFile(item(C))).toBe('title: Gamma\ntags: Urgent\n\n\n');
    await h.press('a', 'z', KEYS.enter);
    expect(lines().slice(1, 3)).toEqual(['  Urgent', '▸ z']);
    await h.press(KEYS.escape);
    expect(lines().slice(0, 3)).toEqual(['▸ • Gamma [Urgent] [z]', '  • Beta [work]', '  • Alpha [work] [Urgent]']);
  });

  it('escape in the entry cancels it; Enter adds, Remove and Back work', async () => {
    h = await mount(THREE);
    await h.press('t', 'a', 'x', KEYS.escape);
    expect(line(1)).toBe('no tags · a to add one');
    expect(line(ROW.buttons)).toBe('Add  Remove  Back');
    await h.press('a', 'n', 'e', 'w', KEYS.enter, 'q');
    expect(line(0)).toBe('▸ • Gamma [new]');
    await h.press('t', KEYS.enter, 'W', 'O', 'R', 'K', KEYS.enter, 'b');
    expect(line(0)).toBe('▸ • Gamma [new] [work]');
    await h.press('t');
    expect(lines().slice(1, 3)).toEqual(['▸ new', '  work']);
    await h.press(KEYS.down, 'r');
    expect(lines().slice(1, 3)).toEqual(['▸ new', '']);
    await h.press(KEYS.delete);
    expect(line(1)).toBe('no tags · a to add one');
    expect(h.fs.readFile(item(C))).toBe('title: Gamma\n\n\n');
    await h.press(KEYS.escape);
    expect(line(0)).toBe('▸ • Gamma');
  });

  it('rejects invalid characters and stays; duplicates close the entry silently', async () => {
    h = await mount(THREE);
    await h.press('t', 'a', 'a', ',', 'b', KEYS.enter);
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    expect(line(ROW.message)).toBe('tags use only letters, numbers, - and _');
    await h.press('a', 'x', KEYS.enter);
    expect(line(1)).toBe('▸ x');
    await h.press('a', 'X', KEYS.enter);
    expect(line(0)).toBe(` Tags › Gamma           ${C}`);
    expect(lines().slice(1, 3)).toEqual(['▸ x', '']);
    expect(line(ROW.input)).not.toMatch(/^Tag:/);
    await h.press('q');
    expect(line(0)).toBe('▸ • Gamma [x]');
  });

  it('right arrow accepts completion at the end; bare letters are shortcuts outside the entry', async () => {
    h = await mount(THREE);
    await h.press('t', 'a', 'w', KEYS.right, KEYS.enter);
    expect(line(1)).toBe('▸ work');
    await h.press('x');
    expect(line(ROW.buttons)).toBe('Add  Remove  Back');
  });
});

describe('Search', () => {
  it('filters live, keeps on enter, clears on escape', async () => {
    h = await mount(THREE);
    await h.press('/', 'a');
    expect(line(0)).toBe('Search: a · 3 of 3');
    expect(line(ROW.input)).toBe('Search: a');
    await h.press('l');
    expect(lines().slice(0, 2)).toEqual(['Search: al · 1 of 3', '▸ • Alpha [work] [Urgent]']);
    await h.press(KEYS.enter);
    expect(line(ROW.input)).not.toMatch(/^Search:/);
    expect(line(0)).toBe('Search: al · 1 of 3');
    await h.press('/', KEYS.escape);
    expect(lines().slice(0, 3)).toEqual(['  • Gamma', '  • Beta [work]', '▸ • Alpha [work] [Urgent]']);
  });

  it('matches text and tags; terms are ANDed; quotes keep phrases', async () => {
    h = await mount(THREE);
    await h.press('/', ...'urgent', KEYS.enter);
    expect(lines().slice(0, 2)).toEqual(['Search: urgent · 1 of 3', '▸ • Alpha [work] [Urgent]']);
    await h.press('/', ...KEYS.backspace.repeat(6), ...'line work', KEYS.enter);
    expect(lines().slice(0, 2)).toEqual(['Search: line work · 1 of 3', '▸ • Beta [work]']);
    await h.press('/', ...KEYS.backspace.repeat(9), ...'"two line"', KEYS.enter);
    expect(line(0)).toBe('Search: "two line" · 0 of 3');
    await h.press('/', ...KEYS.backspace.repeat(10), ...'"one line"', KEYS.enter);
    expect(line(0)).toBe('Search: "one line" · 0 of 3');
    await h.press('/', ...KEYS.backspace.repeat(10), ...'"line one"', KEYS.enter);
    expect(line(0)).toBe('Search: "line one" · 1 of 3');
  });

  it('opens from the button; escape in the list view clears it', async () => {
    h = await mount(THREE);
    await h.press(KEYS.right, KEYS.right, KEYS.right, KEYS.right, KEYS.enter, 'g', 'a', KEYS.enter);
    expect(line(0)).toBe('Search: ga · 1 of 3');
    await h.press(KEYS.escape);
    expect(line(0)).toBe('▸ • Gamma');
  });

  it('keeps reordering inside the searched list', async () => {
    h = await mount(THREE);
    await h.press('/', 'w', 'o', 'r', 'k', KEYS.enter, KEYS.space, KEYS.down);
    expect(lines().slice(1, 3)).toEqual(['  • Alpha [work] [Urgent]', '↕ • Beta [work]']);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${C}\n${A}\n${B}\n`);
  });
});

describe('Archive view', () => {
  it('lists archived prompts newest first; Back, q and escape return', async () => {
    h = await mount(WITH_ARCHIVE);
    await h.press('v');
    expect(line(0)).toBe(' Archive                     2 archived');
    expect(lines().slice(1, 3)).toEqual(['▸ • Older plan', '  • Old idea [legacy]']);
    expect(line(ROW.buttons)).toBe('Open  Restore  /Search  Back');
    for (const k of ['b', 'q', KEYS.escape]) {
      await h.press(k);
      expect(line(0)).toBe('▸ • Gamma');
      await h.press('v');
    }
  });

  it('shows a hint when empty', async () => {
    h = await mount(THREE);
    await h.press('v');
    expect(line(1)).toBe('archive is empty');
  });

  it('searches its own list', async () => {
    h = await mount(WITH_ARCHIVE);
    await h.press('v', '/', 'o', 'l', 'd', ' ', 't', 'e', 'x', 't', KEYS.enter);
    expect(lines().slice(1, 3)).toEqual(['Search: old text · 1 of 2', '▸ • Old idea [legacy]']);
    await h.press('/', KEYS.escape);
    expect(line(1)).toBe('▸ • Older plan');
  });

  it('opens an archived prompt read-only; Back returns to the archive', async () => {
    h = await mount(WITH_ARCHIVE);
    await h.press('v', KEYS.down, KEYS.enter);
    expect(line(0)).toBe(' Archived › Old idea [legacy]  20250101…');
    expect(line(1)).toBe('old text');
    expect(line(9)).toBe(`─ .prompts/archive/${OLD}.md ──`);
    expect(line(ROW.buttons)).toBe('Restore  Back');
    await h.press('e', KEYS.enter);
    expect(h.edits).toEqual([]);
    await h.press('b');
    expect(line(0)).toMatch(/^ Archive /);
  });

  it('restores from the list: the prompt goes first in the order and is selected', async () => {
    h = await mount(WITH_ARCHIVE);
    await h.press('v', KEYS.down, 'r');
    expect(line(ROW.message)).toBe('Restored Old idea');
    expect(lines().slice(1, 2)).toEqual(['▸ • Older plan']);
    expect(h.fs.exists(item(OLD))).toBe(true);
    expect(h.fs.exists(`/w/.prompts/archive/${OLD}.md`)).toBe(false);
    expect(h.fs.readFile('/w/.prompts/sort.txt')).toBe(`${OLD}\n${C}\n${B}\n${A}\n`);
    await h.press('b');
    expect(lines().slice(0, 2)).toEqual(['▸ • Old idea [legacy]', '  • Gamma']);
  });

  it('restores from the archived prompt view, returning to the archive', async () => {
    h = await mount(WITH_ARCHIVE);
    await h.press('v', 'o', 'r');
    expect(line(0)).toMatch(/^ Archive /);
    expect(line(ROW.message)).toBe('Restored Older plan');
    expect(line(1)).toBe('▸ • Old idea [legacy]');
  });

  it('new ids avoid archived ids', async () => {
    h = await mount(WITH_ARCHIVE, { now: () => new Date(2025, 0, 1, 0, 0, 1) });
    await h.press('n', 'x', KEYS.enter);
    expect(h.fs.exists(item(`${OLD}-2`))).toBe(true);
  });
});

describe('Settings', () => {
  it('edits the editor setting', async () => {
    h = await mount(THREE);
    await h.press('s');
    expect(lines().slice(0, 2)).toEqual([' Settings', '▸ editor:']);
    await h.press(KEYS.enter, 'v', 'i', 'm', KEYS.enter);
    expect(line(1)).toBe('▸ editor: vim');
    expect(h.fs.readFile('/w/.prompts/settings.txt')).toBe('editor: vim\n');
    await h.press('e', KEYS.backspace, KEYS.backspace, KEYS.backspace, KEYS.enter);
    expect(h.fs.readFile('/w/.prompts/settings.txt')).toBe('');
    await h.press('q');
    expect(line(0)).toBe('▸ • Gamma');
  });
});

describe('Reload', () => {
  it('rereads the store and keeps selection and archive marks', async () => {
    h = await mount(THREE);
    await h.press(KEYS.down, 'a');
    h.fs.writeFile(item(A), 'title: Alpha renamed\n');
    h.fs.writeFile(item('20260101-000009'), 'title: Outside\n');
    await h.press('r');
    expect(lines().slice(0, 4)).toEqual(['  • Outside', '  • Gamma', '▸ • ✓ Beta [work]', '  • Alpha renamed']);
  });

  it('reports a broken store and keeps the current state', async () => {
    h = await mount(THREE);
    h.fs.writeFile(item(A), 'nope\n');
    await h.press('r');
    expect(line(ROW.message)).toMatch(new RegExp(`^reload failed: items/${A}`));
    expect(line(2)).toBe('  • Alpha [work] [Urgent]');
  });
});

describe('mouse', () => {
  it('wheel moves the selection; clicks are ignored', async () => {
    h = await mount(THREE);
    await h.press(mouse(65, 0, 0));
    expect(focusedRow()).toBe('• Beta [work]');
    await h.press(mouse(64, 0, 0));
    expect(focusedRow()).toBe('• Gamma');
    await h.press(mouse(0, 5, 2), mouse(0, 5, 11));
    expect(focusedRow()).toBe('• Gamma');
    expect(line(0)).not.toMatch(/^ Open/);
  });
});

describe('errors and size', () => {
  it('shows write failures above the buttons until the next key', async () => {
    h = await mount(THREE);
    h.fs.writeFile = () => {
      throw new Error('disk full');
    };
    await h.press(KEYS.space, KEYS.down);
    expect(line(ROW.message)).toBe('disk full');
    expect(line(ROW.buttons)).toContain('New');
    await h.press(KEYS.down);
    expect(line(ROW.message)).toBe('──── moving · press space when done ────');
  });

  it('refuses to draw below the minimum size', async () => {
    h = await mount(THREE, { rows: 8 });
    expect(plain(h.frame()).trim()).toBe('terminal too small');
    await h.press('n');
    expect(plain(h.frame()).trim()).toBe('terminal too small');
    await h.press('q');
    expect(h.exit()).toEqual({ archived: 0 });
  });
});
