import { useInput } from 'ink';
import { toAction, type KeyAction } from '../keys.js';

/** Subscribe to normalized key actions while `active`. */
export function useKeyActions(handler: (action: NonNullable<KeyAction>) => void, active = true): void {
  useInput(
    (input, key) => {
      const action = toAction(input, key);
      if (action) handler(action);
    },
    { isActive: active },
  );
}
