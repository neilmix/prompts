import { useState } from 'react';
import type { KeyAction } from '../keys.js';

export interface Button {
  label: string;
  /** Letter that, with Ctrl, activates the button. */
  shortcut: string;
  onActivate: () => void;
}

export interface Buttons {
  buttons: Button[];
  selected: number;
  /** Consume Tab, Enter and Ctrl+letter. Returns true when consumed. */
  handle(action: NonNullable<KeyAction>): boolean;
}

export function useButtons(buttons: Button[]): Buttons {
  const [selected, setSelected] = useState(0);
  const handle = (action: NonNullable<KeyAction>): boolean => {
    switch (action.type) {
      case 'tab':
        setSelected((s) => (s + 1) % buttons.length);
        return true;
      case 'enter':
        buttons[selected]?.onActivate();
        return true;
      case 'shortcut': {
        const b = buttons.find((x) => x.shortcut === action.letter);
        if (!b) return false;
        b.onActivate();
        return true;
      }
      default:
        return false;
    }
  };
  return { buttons, selected, handle };
}
