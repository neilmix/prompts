import { Box, Text } from 'ink';

export const TITLE_BAR_HEIGHT = 1;

export function TitleBar({ title, right, columns }: { title: string; right?: string | undefined; columns: number }) {
  const r = right ? ` ${right} ` : '';
  const left = ` ${title} `;
  const pad = Math.max(0, columns - left.length - r.length);
  return (
    <Box height={TITLE_BAR_HEIGHT} width={columns}>
      <Text inverse wrap="truncate">
        <Text bold>{left}</Text>
        {' '.repeat(pad)}
        <Text dimColor>{r}</Text>
      </Text>
    </Box>
  );
}
