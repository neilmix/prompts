import type { Fs } from './fs.js';
import { isValidId } from './ids.js';
import type { Paths } from './paths.js';
import type { LoadResult } from './settings.js';

export function loadSort(fs: Fs, paths: Paths): LoadResult<string[]> {
  const errors: string[] = [];
  const value: string[] = [];
  fs.readFile(paths.sort)
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim();
      if (line === '') return;
      if (!isValidId(line)) errors.push(`sort.txt: line ${i + 1}: invalid id "${line}"`);
      else value.push(line);
    });
  return { value, errors };
}

export function saveSort(fs: Fs, paths: Paths, ids: string[]): void {
  fs.writeFile(paths.sort, ids.map((id) => `${id}\n`).join(''));
}

/**
 * Display order: ids missing from `sort` first, newest first, then `sort`
 * order with unknown ids dropped.
 */
export function displayOrder(ids: Iterable<string>, sort: readonly string[]): string[] {
  const all = new Set(ids);
  const sorted = sort.filter((id, i) => all.has(id) && sort.indexOf(id) === i);
  const listed = new Set(sorted);
  const unlisted = [...all].filter((id) => !listed.has(id)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return [...unlisted, ...sorted];
}

/**
 * Move `id` one step in `visible`. Returns the new full order, or null when
 * there is nowhere to go. `full` must be a complete display order.
 */
export function moveInOrder(
  full: readonly string[],
  visible: readonly string[],
  id: string,
  dir: 'up' | 'down',
): string[] | null {
  const vi = visible.indexOf(id);
  if (vi < 0) return null;
  const ni = dir === 'up' ? vi - 1 : vi + 1;
  const neighbor = visible[ni];
  if (neighbor === undefined) return null;
  const without = full.filter((x) => x !== id);
  const at = without.indexOf(neighbor);
  if (at < 0) return null;
  without.splice(dir === 'up' ? at : at + 1, 0, id);
  return without;
}
