import { Box, Text } from 'ink';
import type { Row } from '../text.js';

export const GUTTER = 2;

export interface ListBodyProps {
  rows: Row[];
  selected: number;
  focused: boolean;
  /** The selected item is being moved: `↕` gutter, magenta row. */
  moving?: boolean;
  height: number;
  emptyText: string;
  header?: string | undefined;
}

/** Renders pre-laid-out rows with a gutter marker on the selected item. */
export function ListBody({ rows, selected, focused, moving = false, height, emptyText, header }: ListBodyProps) {
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
          const gutter = sel && r.first ? (moving ? '↕ ' : '▸ ') : '  ';
          const text = r.text || ' ';
          const body =
            r.tail === undefined ? (
              text
            ) : (
              <>
                {text.slice(0, r.tail)}
                <Text color="cyan">{text.slice(r.tail)}</Text>
              </>
            );
          return (
            <Text key={i} wrap="truncate">
              {sel ? <Text color={moving ? 'magenta' : 'blue'}>{gutter}</Text> : gutter}
              {!sel ? body : moving ? (
                <Text bold color="white" backgroundColor="magenta">
                  {body}
                </Text>
              ) : focused ? (
                <Text bold color="white" backgroundColor="blue">
                  {body}
                </Text>
              ) : (
                <Text bold>{body}</Text>
              )}
            </Text>
          );
        })
      )}
    </Box>
  );
}
