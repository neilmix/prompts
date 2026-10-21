import { Box, Text, useApp, useInput } from 'ink';
import { STORE_VERSION } from '../store/open.js';
import { useKeyActions } from './hooks/useKeyActions.js';

export const SETUP_QUESTION = 'This directory is not configured for prompts. Configure now?';
export const UPGRADE_QUESTION = `Upgrade .prompts to version ${STORE_VERSION}?`;

/**
 * A y/n question asked before the app starts: setup by default, or the
 * upgrade. Exits Ink with `true` (yes) or `false` (decline).
 */
export function Setup({ dir, question = SETUP_QUESTION, onAnswer }: { dir: string; question?: string; onAnswer?: (yes: boolean) => void }) {
  const { exit } = useApp();
  const answer = (yes: boolean) => (onAnswer ?? exit)(yes);
  // toAction drops Ctrl keys, so ^C needs a raw useInput.
  useInput((input, key) => {
    if (key.ctrl && input === 'c') answer(false);
  });
  useKeyActions((a) => {
    if (a.type === 'char' && a.text.toLowerCase() === 'y') answer(true);
    else if ((a.type === 'char' && a.text.toLowerCase() === 'n') || a.type === 'escape') answer(false);
  });
  return (
    <Box flexDirection="column">
      <Text dimColor>{dir}</Text>
      <Text>
        {question} <Text bold>(y/n)</Text>
      </Text>
    </Box>
  );
}
