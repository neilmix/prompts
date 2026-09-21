import { Box, Text } from 'ink';
import { wrapText } from '../text.js';
import { Separator } from './CommandPane.js';

export function tagPaneLines(tags: readonly string[], columns: number): string[] {
  return tags.length === 0 ? [''] : wrapText(tags.join('  '), columns);
}

/** Height including the separator line. */
export function tagPaneHeight(tags: readonly string[], columns: number): number {
  return tagPaneLines(tags, columns).length + 1;
}

export function TagPane({ tags, columns }: { tags: readonly string[]; columns: number }) {
  const lines = tagPaneLines(tags, columns);
  return (
    <Box flexDirection="column" height={lines.length + 1}>
      <Separator columns={columns} />
      {lines.map((l, i) => (
        <Text key={i} color="cyan" wrap="truncate">
          {l === '' ? ' ' : l}
        </Text>
      ))}
    </Box>
  );
}
