import { useWindowSize } from 'ink';

export interface Size {
  rows: number;
  columns: number;
}

export function useSize(override?: Size): Size {
  const live = useWindowSize();
  return override ?? live;
}
