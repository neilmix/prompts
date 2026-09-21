import { Box, Text } from 'ink';
import type { Button } from '../hooks/useButtons.js';

export const COMMAND_PANE_HEIGHT = 2;

export function CommandPane({
  buttons,
  selected,
  error,
  columns,
}: {
  buttons: Button[];
  selected: number;
  error: string | null;
  columns: number;
}) {
  return (
    <Box flexDirection="column" height={COMMAND_PANE_HEIGHT} width={columns} overflow="hidden">
      <Separator columns={columns} />
      <Box flexWrap="nowrap">
        {error !== null ? (
          <Text color="red" wrap="truncate">
            {error}
          </Text>
        ) : (
          buttons.map((b, i) => (
            <Box key={b.label} marginRight={2} flexShrink={0}>
              <Text inverse={i === selected}>{b.label}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export function Separator({ columns }: { columns: number }) {
  return (
    <Box height={1}>
      <Text dimColor>{'─'.repeat(Math.max(0, columns))}</Text>
    </Box>
  );
}
