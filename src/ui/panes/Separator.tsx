import { Box, Text } from 'ink';

/** Full-width `─` rule with an optional dim label on the left and counter on the right. */
export function Separator({ columns, label, right }: { columns: number; label?: string | null; right?: string | null }) {
  const r = right ? ` ${right} ─` : '';
  let l = label ? `─ ${label} ` : '';
  const room = columns - r.length - 2;
  if (l.length > room) l = room > 3 ? `${l.slice(0, room - 1)}… ` : '';
  const fill = Math.max(0, columns - l.length - r.length);
  return (
    <Box height={1}>
      <Text dimColor>
        {l}
        {'─'.repeat(fill)}
        {r}
      </Text>
    </Box>
  );
}
