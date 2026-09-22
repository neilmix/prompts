import { Box, Text, useApp, useInput } from 'ink';
import { useKeyActions } from './hooks/useKeyActions.js';

export const SETUP_QUESTION = 'This directory is not configured for prompts. Configure now?';

/** First-run question. Exits Ink with `true` (configure) or `false` (decline). */
export function Setup({ dir, onAnswer }: { dir: string; onAnswer?: (yes: boolean) => void }) {
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
        {SETUP_QUESTION} <Text bold>(y/n)</Text>
      </Text>
    </Box>
  );
}
