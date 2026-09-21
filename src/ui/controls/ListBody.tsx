import { Box, Text } from 'ink';
import type { Row } from '../text.js';

export const GUTTER = 2;

export interface ListBodyProps {
  rows: Row[];
  selected: number;
  focused: boolean;
  height: number;
  emptyText: string;
  header?: string | undefined;
}

/** Renders pre-laid-out rows with a gutter marker on the selected item. */
export function ListBody({ rows, selected, focused, height, emptyText, header }: ListBodyProps) {
  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {header !== undefined && (
        <Text color="yellow" wrap="truncate">
          {header}
        </Text>
      )}
      {rows.length === 0 ? (
        <Text color="gray">{emptyText}</Text>
      ) : (
        rows.map((r, i) => {
          const sel = r.item === selected;
          const gutter = sel && r.first ? '▸ ' : '  ';
          const text = r.text || ' ';
          return (
            <Text key={i} wrap="truncate">
              {sel ? <Text color="blue">{gutter}</Text> : gutter}
              {!sel ? text : focused ? (
                <Text bold color="white" backgroundColor="blue">
                  {text}
                </Text>
              ) : (
                <Text bold>{text}</Text>
              )}
            </Text>
          );
        })
      )}
    </Box>
  );
}
