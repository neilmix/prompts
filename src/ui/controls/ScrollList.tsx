import { Box, Text } from 'ink';
import { useRef } from 'react';
import { layoutBlocks, scrollToShow } from '../text.js';

export interface ScrollListProps {
  items: readonly string[];
  selected: number;
  height: number;
  width: number;
  /** Blank lines between items. */
  gap?: number;
  emptyText: string;
  /** Optional first line, shown dim, that takes one row of `height`. */
  header?: string | undefined;
}

/** A wrapping, scrolling, single-select list that keeps the selection visible. */
export function ScrollList({ items, selected, height, width, gap = 1, emptyText, header }: ScrollListProps) {
  const topRef = useRef(0);
  const bodyHeight = Math.max(0, height - (header === undefined ? 0 : 1));
  const blocks = layoutBlocks(items, width, gap);
  const total = blocks.length === 0 ? 0 : blocks[blocks.length - 1]!.start + blocks[blocks.length - 1]!.lines.length;
  const sel = blocks[selected];
  if (sel) topRef.current = scrollToShow(topRef.current, sel.start, sel.start + sel.lines.length, bodyHeight, total);
  else topRef.current = 0;
  const top = topRef.current;

  const rows: { text: string; item: number }[] = [];
  for (const b of blocks) {
    b.lines.forEach((text, i) => (rows[b.start + i] = { text, item: b.item }));
  }
  const visible = [];
  for (let i = top; i < Math.min(total, top + bodyHeight); i++) {
    const r = rows[i] ?? { text: '', item: -1 };
    visible.push(
      <Text key={i} inverse={r.item === selected} wrap="truncate">
        {r.item === selected ? r.text.padEnd(width) : r.text === '' ? ' ' : r.text}
      </Text>,
    );
  }

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {header !== undefined && (
        <Text color="gray" wrap="truncate">
          {header}
        </Text>
      )}
      {items.length === 0 ? <Text color="gray">{emptyText}</Text> : visible}
    </Box>
  );
}
