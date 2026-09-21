import * as path from 'node:path';

export const PROMPTS_DIR = '.prompts';

export interface Paths {
  root: string;
  settings: string;
  sort: string;
  index: string;
  text: string;
  indexFile(id: string): string;
  textFile(id: string): string;
}

export function pathsFor(dir: string): Paths {
  const root = path.join(dir, PROMPTS_DIR);
  const index = path.join(root, 'index');
  const text = path.join(root, 'text');
  return {
    root,
    settings: path.join(root, 'settings.txt'),
    sort: path.join(root, 'sort.txt'),
    index,
    text,
    indexFile: (id) => path.join(index, `${id}.txt`),
    textFile: (id) => path.join(text, `${id}.txt`),
  };
}
