import type { Key } from 'ink';

export type KeyAction =
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'pageUp' }
  | { type: 'pageDown' }
  | { type: 'top' }
  | { type: 'bottom' }
  | { type: 'moveUp' }
  | { type: 'moveDown' }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'tab' }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'space' }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'shortcut'; letter: string }
  | { type: 'char'; text: string }
  | null;

/** Normalize Ink's (input, key) into one named action. */
export function toAction(input: string, key: Key): KeyAction {
  if (key.upArrow || key.downArrow) {
    const up = key.upArrow;
    if (key.ctrl && key.shift) return { type: up ? 'top' : 'bottom' };
    if (key.ctrl) return { type: up ? 'pageUp' : 'pageDown' };
    if (key.shift) return { type: up ? 'moveUp' : 'moveDown' };
    return { type: up ? 'up' : 'down' };
  }
  if (key.pageUp) return { type: 'pageUp' };
  if (key.pageDown) return { type: 'pageDown' };
  if (key.leftArrow) return { type: 'left' };
  if (key.rightArrow) return { type: 'right' };
  if (key.home) return { type: 'home' };
  if (key.end) return { type: 'end' };
  if (key.tab) return { type: 'tab' };
  if (key.return) return { type: 'enter' };
  if (key.escape) return { type: 'escape' };
  if (key.backspace) return { type: 'backspace' };
  if (key.delete) return { type: 'delete' };
  if (key.ctrl) {
    return /^[a-z]$/.test(input) ? { type: 'shortcut', letter: input } : null;
  }
  if (key.meta) return null;
  if (input === ' ') return { type: 'space' };
  if (input.length > 0 && !/[\x00-\x1f\x7f]/.test(input)) return { type: 'char', text: input };
  return null;
}
