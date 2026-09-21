import { describe, expect, it } from 'vitest';
import { parseSettings, serializeSettings } from './format.js';

describe('parseSettings', () => {
  it('parses key: value lines', () => {
    expect(parseSettings('title: Hello\ntags: a, b\n')).toEqual({
      title: 'Hello',
      tags: 'a, b',
    });
  });

  it('ignores blank lines and trims values', () => {
    expect(parseSettings('\ntitle:   x  \n\n')).toEqual({ title: 'x' });
  });

  it('allows empty values', () => {
    expect(parseSettings('tags: \n')).toEqual({ tags: '' });
    expect(parseSettings('tags:\n')).toEqual({ tags: '' });
  });

  it('parses an empty file', () => {
    expect(parseSettings('')).toEqual({});
  });

  it('rejects malformed lines', () => {
    expect(() => parseSettings('no separator\n')).toThrow(/line 1/);
    expect(() => parseSettings('bad key!: x\n')).toThrow(/line 1/);
    expect(() => parseSettings('ok: 1\nkey:value\n')).toThrow(/line 2/);
  });

  it('rejects duplicate keys', () => {
    expect(() => parseSettings('a: 1\na: 2\n')).toThrow(/duplicate key "a"/);
  });

  it('accepts CRLF line endings', () => {
    expect(parseSettings('a: 1\r\nb: 2\r\n')).toEqual({ a: '1', b: '2' });
  });
});

describe('serializeSettings', () => {
  it('writes key: value lines ending in newline', () => {
    expect(serializeSettings({ title: 'Hello', tags: 'a, b' })).toBe(
      'title: Hello\ntags: a, b\n',
    );
  });

  it('writes an empty string for no entries', () => {
    expect(serializeSettings({})).toBe('');
  });

  it('round-trips', () => {
    const text = 'editor: code --wait\n';
    expect(serializeSettings(parseSettings(text))).toBe(text);
  });
});
