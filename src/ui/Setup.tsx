import { Box, Text, useApp } from 'ink';
import { useKeyActions } from './hooks/useKeyActions.js';

export const SETUP_QUESTION = 'This directory is not configured for prompts. Configure now?';

/** First-run question. Exits Ink with `true` (configure) or `false` (decline). */
export function Setup({ dir, onAnswer }: { dir: string; onAnswer?: (yes: boolean) => void }) {
  const { exit } = useApp();
  const answer = (yes: boolean) => (onAnswer ?? exit)(yes);
  useKeyActions((a) => {
    if (a.type === 'char' && a.text.toLowerCase() === 'y') answer(true);
    else if ((a.type === 'char' && a.text.toLowerCase() === 'n') || a.type === 'escape' || a.type === 'shortcut') answer(false);
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
