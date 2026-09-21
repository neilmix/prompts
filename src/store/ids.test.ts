import { describe, expect, it } from 'vitest';
import { formatId, isValidId, nextFreeId } from './ids.js';

describe('formatId', () => {
  it('formats local time as YYYYMMDD-HHMMSS', () => {
    expect(formatId(new Date(2026, 8, 21, 14, 30, 5))).toBe('20260921-143005');
  });

  it('zero-pads', () => {
    expect(formatId(new Date(2026, 0, 1, 0, 0, 0))).toBe('20260101-000000');
  });
});

describe('isValidId', () => {
  it('accepts base ids and suffixed ids', () => {
    expect(isValidId('20260921-143005')).toBe(true);
    expect(isValidId('20260921-143005-2')).toBe(true);
    expect(isValidId('20260921-143005-13')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidId('2026092-143005')).toBe(false);
    expect(isValidId('20260921-143005-')).toBe(false);
    expect(isValidId('20260921-143005-0')).toBe(false);
    expect(isValidId('20260921-143005-1')).toBe(false);
    expect(isValidId('20260921-143005.txt')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe('nextFreeId', () => {
  it('returns the base id when free', () => {
    expect(nextFreeId('20260921-143005', new Set())).toBe('20260921-143005');
  });

  it('appends -2, -3 on collision', () => {
    const taken = new Set(['20260921-143005', '20260921-143005-2']);
    expect(nextFreeId('20260921-143005', taken)).toBe('20260921-143005-3');
  });
});
