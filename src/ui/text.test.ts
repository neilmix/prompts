import { describe, expect, it } from 'vitest';
import { layoutBlocks, scrollToShow, wrapText } from './text.js';

describe('wrapText', () => {
  it('wraps on spaces', () => {
    expect(wrapText('the quick brown fox', 9)).toEqual(['the quick', 'brown fox']);
  });

  it('keeps short text on one line', () => {
    expect(wrapText('hi', 10)).toEqual(['hi']);
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

describe('layoutBlocks', () => {
  it('computes start lines with gaps', () => {
    const blocks = layoutBlocks(['one two', 'three'], 4);
    expect(blocks.map((b) => [b.start, b.lines])).toEqual([
      [0, ['one', 'two']],
      [3, ['thre', 'e']],
    ]);
  });
});

describe('scrollToShow', () => {
  it('scrolls minimally', () => {
    expect(scrollToShow(0, 2, 3, 5, 20)).toBe(0);
    expect(scrollToShow(0, 6, 8, 5, 20)).toBe(3);
    expect(scrollToShow(10, 6, 8, 5, 20)).toBe(6);
    expect(scrollToShow(10, 19, 20, 5, 20)).toBe(15);
  });

  it('clamps to content', () => {
    expect(scrollToShow(10, 0, 1, 5, 3)).toBe(0);
    expect(scrollToShow(0, 2, 3, 5, 3)).toBe(0);
  });
});
