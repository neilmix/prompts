import { describe, expect, it } from 'vitest';
import type { Key } from 'ink';
import { toAction, vimAction } from './keys.js';

const key = (over: Partial<Key> = {}): Key => ({
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
  pageDown: false, pageUp: false, home: false, end: false, return: false,
  escape: false, ctrl: false, shift: false, tab: false, backspace: false,
  delete: false, meta: false, super: false, hyper: false, capsLock: false,
  numLock: false, ...over,
});

describe('toAction', () => {
  it('maps arrows and navigation keys, ignoring arrow modifiers', () => {
    expect(toAction('', key({ upArrow: true }))).toEqual({ type: 'up' });
    expect(toAction('down', key({ downArrow: true, ctrl: true }))).toEqual({ type: 'down' });
    expect(toAction('', key({ upArrow: true, shift: true }))).toEqual({ type: 'up' });
    expect(toAction('down', key({ downArrow: true, ctrl: true, shift: true }))).toEqual({ type: 'down' });
    expect(toAction('', key({ pageUp: true }))).toEqual({ type: 'pageUp' });
    expect(toAction('', key({ pageDown: true }))).toEqual({ type: 'pageDown' });
    expect(toAction('', key({ home: true }))).toEqual({ type: 'home' });
    expect(toAction('', key({ end: true }))).toEqual({ type: 'end' });
    expect(toAction('', key({ leftArrow: true }))).toEqual({ type: 'left' });
  });

  it('maps control keys', () => {
    expect(toAction('', key({ tab: true }))).toEqual({ type: 'tab' });
    expect(toAction('', key({ return: true }))).toEqual({ type: 'enter' });
    expect(toAction('', key({ escape: true }))).toEqual({ type: 'escape' });
    expect(toAction(' ', key())).toEqual({ type: 'space' });
    expect(toAction('', key({ backspace: true }))).toEqual({ type: 'backspace' });
    expect(toAction('', key({ delete: true }))).toEqual({ type: 'delete' });
  });

  it('ignores ctrl+letter', () => {
    expect(toAction('n', key({ ctrl: true }))).toBeNull();
    expect(toAction('', key({ ctrl: true }))).toBeNull();
  });

  it('maps printable text to char and drops control chars', () => {
    expect(toAction('a', key())).toEqual({ type: 'char', text: 'a' });
    expect(toAction('A', key({ shift: true }))).toEqual({ type: 'char', text: 'A' });
    expect(toAction('\x01', key())).toBeNull();
    expect(toAction('', key())).toBeNull();
    expect(toAction('x', key({ meta: true }))).toBeNull();
  });

  it('decodes SGR wheel reports and drops clicks', () => {
    expect(toAction('[<64;1;1M', key())).toEqual({ type: 'wheel', by: -1 });
    expect(toAction('[<65;1;1M', key())).toEqual({ type: 'wheel', by: 1 });
    expect(toAction('[<0;12;5M', key())).toBeNull();
    expect(toAction('[<0;12;5m', key())).toBeNull();
    expect(toAction('[<2;12;5M', key())).toBeNull();
  });
});

describe('vimAction', () => {
  it('maps j k g G', () => {
    expect(vimAction({ type: 'char', text: 'j' })).toEqual({ type: 'down' });
    expect(vimAction({ type: 'char', text: 'k' })).toEqual({ type: 'up' });
    expect(vimAction({ type: 'char', text: 'g' })).toEqual({ type: 'top' });
    expect(vimAction({ type: 'char', text: 'G' })).toEqual({ type: 'bottom' });
    expect(vimAction({ type: 'char', text: 'x' })).toBeNull();
    expect(vimAction({ type: 'up' })).toBeNull();
  });
});
