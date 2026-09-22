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
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'tab' }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'space' }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'char'; text: string }
  | { type: 'mouse'; button: 'left' | 'wheelUp' | 'wheelDown' | 'other'; x: number; y: number }
  | null;

// SGR mouse report `ESC [ < b ; x ; y M`. Ink strips the ESC before
// useInput sees it, so the match starts at `[`.
const MOUSE_RE = /^\[<(\d+);(\d+);(\d+)([mM])$/;

/** Normalize Ink's (input, key) into one named action. */
export function toAction(input: string, key: Key): KeyAction {
  // Modifiers on arrows are ignored: terminals disagree on whether they
  // send them at all (Terminal.app sends none by default).
  if (key.upArrow) return { type: 'up' };
  if (key.downArrow) return { type: 'down' };
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
  if (key.ctrl) return null;
  if (key.meta) return null;
  const m = MOUSE_RE.exec(input);
  if (m) {
    if (m[4] !== 'M') return null;
    const code = Number(m[1]);
    const button = code === 0 ? 'left' : code === 64 ? 'wheelUp' : code === 65 ? 'wheelDown' : 'other';
    return { type: 'mouse', button, x: Number(m[2]) - 1, y: Number(m[3]) - 1 };
  }
  if (input === ' ') return { type: 'space' };
  if (input.length > 0 && !/[\x00-\x1f\x7f]/.test(input)) return { type: 'char', text: input };
  return null;
}

/** Map vim-style letters to body actions. Returns null when not a vim key. */
export function vimAction(action: NonNullable<KeyAction>): NonNullable<KeyAction> | null {
  if (action.type !== 'char') return null;
  switch (action.text) {
    case 'j': return { type: 'down' };
    case 'k': return { type: 'up' };
    case 'g': return { type: 'top' };
    case 'G': return { type: 'bottom' };
    default: return null;
  }
}

export const MOUSE_ON = '\x1b[?1000h\x1b[?1006h';
export const MOUSE_OFF = '\x1b[?1000l\x1b[?1006l';
