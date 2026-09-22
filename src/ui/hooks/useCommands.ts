import { useState } from 'react';
import type { KeyAction } from '../keys.js';

export interface Button {
  label: string;
  /** Lowercase letter that activates the button. Must appear in the label. */
  shortcut: string;
  onActivate: () => void;
}

export interface Commands {
  buttons: Button[];
  /** 0 = body has focus; n = button n-1 has focus. */
  focus: number;
  setFocus: (f: number) => void;
  /** Consume focus movement, Enter and shortcut letters. Returns true when consumed. */
  handle(action: NonNullable<KeyAction>): boolean;
}

/** Focus model shared by every view: the body, then the buttons. */
export function useCommands(buttons: Button[], primary: () => void): Commands {
  const [focus, setFocus] = useState(0);
  const last = buttons.length;
  const handle = (action: NonNullable<KeyAction>): boolean => {
    switch (action.type) {
      case 'left':
        setFocus(Math.max(0, focus - 1));
        return true;
      case 'right':
        setFocus(Math.min(last, focus + 1));
        return true;
      case 'tab':
        setFocus((focus + 1) % (last + 1));
        return true;
      case 'enter':
        if (focus === 0) primary();
        else buttons[focus - 1]?.onActivate();
        return true;
      case 'char': {
        const b = buttons.find((x) => x.shortcut === action.text);
        if (!b) return false;
        b.onActivate();
        return true;
      }
      default:
        return false;
    }
  };
  return { buttons, focus, setFocus, handle };
}
