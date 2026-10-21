import * as path from 'node:path';

export const PROMPTS_DIR = '.prompts';

export interface Paths {
  root: string;
  readme: string;
  version: string;
  settings: string;
  sort: string;
  items: string;
  archive: string;
  itemFile(id: string): string;
  archiveFile(id: string): string;
}

export function pathsFor(dir: string): Paths {
  const root = path.join(dir, PROMPTS_DIR);
  const items = path.join(root, 'items');
  const archive = path.join(root, 'archive');
  return {
    root,
    readme: path.join(root, 'README.md'),
    version: path.join(root, 'VERSION'),
    settings: path.join(root, 'settings.txt'),
    sort: path.join(root, 'sort.txt'),
    items,
    archive,
    itemFile: (id) => path.join(items, `${id}.md`),
    archiveFile: (id) => path.join(archive, `${id}.md`),
  };
}

/** Version 0 layout, read only by the upgrade. */
export interface LegacyPaths {
  index: string;
  text: string;
  indexFile(id: string): string;
  textFile(id: string): string;
}

export function legacyPathsFor(paths: Paths): LegacyPaths {
  const index = path.join(paths.root, 'index');
  const text = path.join(paths.root, 'text');
  return {
    index,
    text,
    indexFile: (id) => path.join(index, `${id}.txt`),
    textFile: (id) => path.join(text, `${id}.txt`),
  };
}
