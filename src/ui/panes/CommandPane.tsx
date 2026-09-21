import { Box, Text } from 'ink';
import type { Message } from '../../model/types.js';
import type { Button } from '../hooks/useCommands.js';
import { Separator } from './Separator.js';

export function commandPaneHeight(message: Message | null): number {
  return message ? 3 : 2;
}

export function CommandPane({
  buttons,
  focus,
  message,
  columns,
}: {
  buttons: Button[];
  /** 0 = none focused; n = button n-1. */
  focus: number;
  message: Message | null;
  columns: number;
}) {
  return (
    <Box flexDirection="column" height={commandPaneHeight(message)} width={columns} overflow="hidden">
      <Separator columns={columns} />
      {message && (
        <Text color={message.kind === 'error' ? 'red' : 'green'} wrap="truncate">
          {message.text}
        </Text>
      )}
      <Box flexWrap="nowrap">
        {buttons.map((b, i) => (
          <Box key={b.label} marginRight={2} flexShrink={0}>
            <ButtonLabel button={b} focused={i + 1 === focus} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ButtonLabel({ button, focused }: { button: Button; focused: boolean }) {
  const i = button.label.toLowerCase().indexOf(button.shortcut);
  const at = i < 0 ? button.label.length : i;
  return (
    <Text inverse={focused}>
      {button.label.slice(0, at)}
      <Text underline>{button.label.slice(at, at + 1)}</Text>
      {button.label.slice(at + 1)}
    </Text>
  );
}
