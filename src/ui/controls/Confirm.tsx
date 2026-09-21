import { Box, Text } from 'ink';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { Separator } from '../panes/Separator.js';

export const CONFIRM_HEIGHT = 2;

/** A y/n question in the input pane. Takes over input while mounted. */
export function Confirm({ question, onYes, onNo, columns }: { question: string; onYes: () => void; onNo: () => void; columns: number }) {
  useKeyActions((a) => {
    if (a.type === 'char' && a.text.toLowerCase() === 'y') onYes();
    else if ((a.type === 'char' && a.text.toLowerCase() === 'n') || a.type === 'escape') onNo();
  });
  return (
    <Box flexDirection="column" height={CONFIRM_HEIGHT} width={columns}>
      <Separator columns={columns} />
      <Text bold>{question} (y/n)</Text>
    </Box>
  );
}
