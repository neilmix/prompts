import { Box, Text } from 'ink';

export const TITLE_BAR_HEIGHT = 1;

export function TitleBar({ title }: { title: string }) {
  return (
    <Box height={TITLE_BAR_HEIGHT} width="100%">
      <Text bold inverse wrap="truncate">
        {` ${title} `}
      </Text>
    </Box>
  );
}
