import { Box, Text } from 'ink';

/**
 * Full-width `─` rule with an optional dim label on the left, counter on
 * the right, or text centered in the rule.
 */
export function Separator({
  columns,
  label,
  right,
  center,
}: {
  columns: number;
  label?: string | null;
  right?: string | null;
  center?: string | null;
}) {
  const r = right ? ` ${right} ─` : '';
  let l = label ? `─ ${label} ` : '';
  const room = columns - r.length - 2;
  if (l.length > room) l = room > 3 ? `${l.slice(0, room - 1)}… ` : '';
  const fill = Math.max(0, columns - l.length - r.length);
  // Centered text needs a space and at least one `─` on each side.
  const c = center && center.length + 4 <= fill ? ` ${center} ` : '';
  const left = Math.floor((fill - c.length) / 2);
  return (
    <Box height={1}>
      <Text dimColor>
        {l}
        {'─'.repeat(left)}
        {c}
        {'─'.repeat(fill - left - c.length)}
        {r}
      </Text>
    </Box>
  );
}
