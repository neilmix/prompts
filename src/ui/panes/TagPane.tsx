import { Box, Text } from 'ink';
import { wrapText } from '../text.js';
import { Separator } from './Separator.js';

export const chips = (tags: readonly string[]): string => tags.map((t) => `[${t}]`).join(' ');

export function tagPaneLines(tags: readonly string[], columns: number): string[] {
  return tags.length === 0 ? [''] : wrapText(chips(tags), columns);
}

/** Height including the separator line. */
export function tagPaneHeight(tags: readonly string[], columns: number): number {
  return tagPaneLines(tags, columns).length + 1;
}

export function TagPane({
  tags,
  columns,
  label = 'tags',
  right,
}: {
  tags: readonly string[];
  columns: number;
  /** Label on the separator above the chips. */
  label?: string;
  right?: string | null;
}) {
  const lines = tagPaneLines(tags, columns);
  return (
    <Box flexDirection="column" height={lines.length + 1}>
      <Separator columns={columns} label={label} right={right ?? null} />
      {lines.map((l, i) => (
        <Text key={i} color="cyan" wrap="truncate">
          {l === '' ? ' ' : l}
        </Text>
      ))}
    </Box>
  );
}
