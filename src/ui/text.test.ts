import { describe, expect, it } from 'vitest';
import { layoutRows, listViewport, rangeLabel, scrollToShow, wrapText } from './text.js';

describe('wrapText', () => {
  it('wraps on spaces', () => {
    expect(wrapText('the quick brown fox', 9)).toEqual(['the quick', 'brown fox']);
  });
  it('breaks long words', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapText('a abcdefghij', 4)).toEqual(['a', 'abcd', 'efgh', 'ij']);
  });
  it('honors newlines and empty lines', () => {
    expect(wrapText('a\n\nb', 10)).toEqual(['a', '', 'b']);
    expect(wrapText('', 10)).toEqual(['']);
  });
});

describe('layoutRows', () => {
  it('marks first rows', () => {
    expect(layoutRows(['one two', 'three'], 4)).toEqual([
      { text: 'one', item: 0, first: true },
      { text: 'two', item: 0, first: false },
      { text: 'thre', item: 1, first: true },
      { text: 'e', item: 1, first: false },
    ]);
  });
  it('prefixes first rows and indents continuations by the prefix width', () => {
    expect(layoutRows(['one two', 'x'], 6, '• ')).toEqual([
      { text: '• one', item: 0, first: true },
      { text: '  two', item: 0, first: false },
      { text: '• x', item: 1, first: true },
    ]);
  });
  it('records where a styled tail starts on each row', () => {
    expect(layoutRows([{ text: 'one', tail: '[a]' }], 20, '• ')).toEqual([{ text: '• one [a]', item: 0, first: true, tail: 6 }]);
    expect(layoutRows([{ text: 'one two', tail: '[a] [b]' }], 9, '• ')).toEqual([
      { text: '• one two', item: 0, first: true },
      { text: '  [a] [b]', item: 0, first: false, tail: 2 },
    ]);
    expect(layoutRows([{ text: 'one two', tail: '[aa] [bb]' }], 12, '• ')).toEqual([
      { text: '• one two', item: 0, first: true },
      { text: '  [aa] [bb]', item: 0, first: false, tail: 2 },
    ]);
    expect(layoutRows([{ text: 'one', tail: '[aaaa] [bb]' }], 12, '• ')).toEqual([
      { text: '• one [aaaa]', item: 0, first: true, tail: 6 },
      { text: '  [bb]', item: 0, first: false, tail: 2 },
    ]);
    expect(layoutRows([{ text: 'one', tail: '' }], 20)).toEqual([{ text: 'one', item: 0, first: true }]);
  });
});

describe('scrollToShow', () => {
  it('scrolls minimally and clamps', () => {
    expect(scrollToShow(0, 2, 3, 5, 20)).toBe(0);
    expect(scrollToShow(0, 6, 8, 5, 20)).toBe(3);
    expect(scrollToShow(10, 6, 8, 5, 20)).toBe(6);
    expect(scrollToShow(10, 0, 1, 5, 3)).toBe(0);
  });
});

describe('listViewport', () => {
  const items = ['a', 'b b', 'c', 'd', 'e'];
  it('shows from the top when the selection fits', () => {
    const v = listViewport(items, 0, 3, 10, 0);
    expect(v.top).toBe(0);
    expect(v.rows.map((r) => r.text)).toEqual(['a', 'b b', 'c']);
  });
  it('scrolls to keep a wrapped selection whole', () => {
    const v = listViewport(items, 1, 2, 1, 0);
    expect(v.rows.map((r) => r.text)).toEqual(['b', 'b']);
    expect(v.top).toBe(1);
  });
  it('keeps the previous top when it still shows the selection', () => {
    expect(listViewport(items, 3, 3, 10, 2).top).toBe(2);
    expect(listViewport(items, 3, 3, 10, 0).top).toBe(1);
  });
  it('handles no selection', () => {
    expect(listViewport([], -1, 3, 10, 0)).toEqual({ top: 0, total: 0, rows: [] });
  });
});

describe('rangeLabel', () => {
  it('reports the visible range only on overflow', () => {
    expect(rangeLabel(0, 5, 5)).toBeNull();
    expect(rangeLabel(2, 5, 12)).toBe('3–7 of 12');
    expect(rangeLabel(10, 5, 12)).toBe('11–12 of 12');
  });
});
