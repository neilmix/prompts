import { describe, expect, it } from 'vitest';
import type { Key } from 'ink';
import { toAction } from './keys.js';

const key = (over: Partial<Key> = {}): Key => ({
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
  pageDown: false, pageUp: false, home: false, end: false, return: false,
  escape: false, ctrl: false, shift: false, tab: false, backspace: false,
  delete: false, meta: false, super: false, hyper: false, capsLock: false,
  numLock: false, ...over,
});

describe('toAction', () => {
  it('maps arrows with modifiers', () => {
    expect(toAction('', key({ upArrow: true }))).toEqual({ type: 'up' });
    expect(toAction('down', key({ downArrow: true, ctrl: true }))).toEqual({ type: 'pageDown' });
    expect(toAction('', key({ upArrow: true, shift: true }))).toEqual({ type: 'moveUp' });
    expect(toAction('down', key({ downArrow: true, ctrl: true, shift: true }))).toEqual({ type: 'bottom' });
    expect(toAction('', key({ home: true }))).toEqual({ type: 'home' });
    expect(toAction('', key({ end: true }))).toEqual({ type: 'end' });
  });

  it('maps control keys', () => {
    expect(toAction('', key({ tab: true }))).toEqual({ type: 'tab' });
    expect(toAction('', key({ return: true }))).toEqual({ type: 'enter' });
    expect(toAction('', key({ escape: true }))).toEqual({ type: 'escape' });
    expect(toAction(' ', key())).toEqual({ type: 'space' });
    expect(toAction('', key({ backspace: true }))).toEqual({ type: 'backspace' });
    expect(toAction('', key({ delete: true }))).toEqual({ type: 'delete' });
  });

  it('maps ctrl+letter to a shortcut', () => {
    expect(toAction('n', key({ ctrl: true }))).toEqual({ type: 'shortcut', letter: 'n' });
    expect(toAction('', key({ ctrl: true }))).toBeNull();
  });

  it('maps printable text to char and drops control chars', () => {
    expect(toAction('a', key())).toEqual({ type: 'char', text: 'a' });
    expect(toAction('A', key({ shift: true }))).toEqual({ type: 'char', text: 'A' });
    expect(toAction('héllo', key())).toEqual({ type: 'char', text: 'héllo' });
    expect(toAction('\x01', key())).toBeNull();
    expect(toAction('', key())).toBeNull();
    expect(toAction('x', key({ meta: true }))).toBeNull();
  });
});
