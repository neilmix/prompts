import { Box, Text } from 'ink';

export const TITLE_BAR_HEIGHT = 1;

export function TitleBar({
  title,
  tail,
  right,
  columns,
}: {
  title: string;
  /** Drawn after the title, not bold (e.g. tag chips). */
  tail?: string | undefined;
  right?: string | undefined;
  columns: number;
}) {
  const r = right ? ` ${right} ` : '';
  const left = ` ${title} `;
  const t = tail ? `${tail} ` : '';
  const pad = Math.max(0, columns - left.length - t.length - r.length);
  return (
    <Box height={TITLE_BAR_HEIGHT} width={columns}>
      <Text inverse wrap="truncate">
        <Text bold>{left}</Text>
        {t}
        {' '.repeat(pad)}
        <Text dimColor>{r}</Text>
      </Text>
    </Box>
  );
}
