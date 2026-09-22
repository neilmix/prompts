/** Wrap text into lines no longer than `width`, honoring existing newlines. */
export function wrapText(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];
  for (const para of text.replace(/\t/g, '    ').split(/\r?\n/)) {
    if (para === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      let piece = word;
      while (piece.length > w) {
        if (line !== '') {
          out.push(line);
          line = '';
        }
        out.push(piece.slice(0, w));
        piece = piece.slice(w);
      }
      if (line === '') line = piece;
      else if (line.length + 1 + piece.length <= w) line += ' ' + piece;
      else {
        out.push(line);
        line = piece;
      }
    }
    out.push(line);
  }
  return out;
}

export interface Row {
  text: string;
  /** Index of the item this row belongs to. */
  item: number;
  /** True for the first row of an item. */
  first: boolean;
  /** Column from which the row shows the item's tail (e.g. tag chips), if any. */
  tail?: number;
}

/** A list item: plain text, or text with a differently styled tail appended. */
export type Item = string | { text: string; tail: string };

export const itemText = (item: Item): string => (typeof item === 'string' ? item : item.tail === '' ? item.text : `${item.text} ${item.tail}`);

export interface Viewport {
  top: number;
  total: number;
  rows: Row[];
}

/**
 * Lay out items as wrapped rows. `prefix` (e.g. a bullet) starts each item's
 * first row; continuation rows are indented by its width so wrapped text
 * lines up under the first row's text. An item with a tail gets `tail` set
 * on each row that shows part of it: the column where the tail starts.
 */
export function layoutRows(items: readonly Item[], width: number, prefix = ''): Row[] {
  const rows: Row[] = [];
  const indent = ' '.repeat(prefix.length);
  items.forEach((it, item) => {
    const text = itemText(it);
    // Where the tail begins in `text`; Infinity when there is none.
    const tailAt = typeof it === 'string' || it.tail === '' ? Infinity : it.text.length + 1;
    // Each wrapped line is a contiguous slice of `text`, so its offset can
    // be recovered by searching forward from the previous line's end.
    let at = 0;
    wrapText(text, width - prefix.length).forEach((line, i) => {
      const start = Math.max(at, text.indexOf(line, at));
      at = start + line.length;
      const lead = i === 0 ? prefix : indent;
      const row: Row = { text: lead + line, item, first: i === 0 };
      if (start >= tailAt) row.tail = lead.length;
      else if (at > tailAt) row.tail = lead.length + (tailAt - start);
      rows.push(row);
    });
  });
  return rows;
}

/** Scroll `top` the minimum needed so [start, end) is inside a `height`-line window. */
export function scrollToShow(top: number, start: number, end: number, height: number, total: number): number {
  let t = top;
  if (start < t) t = start;
  else if (end > t + height) t = end - height;
  return Math.max(0, Math.min(t, Math.max(0, total - height)));
}

/** Compute the visible rows of a list, keeping `selected` fully in view. */
export function listViewport(items: readonly Item[], selected: number, height: number, width: number, prevTop: number, prefix = ''): Viewport {
  const rows = layoutRows(items, width, prefix);
  const start = rows.findIndex((r) => r.item === selected);
  let top = 0;
  if (start >= 0) {
    let end = start;
    while (end < rows.length && rows[end]!.item === selected) end++;
    top = scrollToShow(prevTop, start, end, height, rows.length);
  } else top = Math.max(0, Math.min(prevTop, rows.length - height));
  return { top, total: rows.length, rows: rows.slice(top, top + Math.max(0, height)) };
}

/** Tags as chips: `[work] [urgent]`. */
export const chips = (tags: readonly string[]): string => tags.map((t) => `[${t}]`).join(' ');

/** `3–9 of 42` when the content overflows, else null. */
export function rangeLabel(top: number, shown: number, total: number): string | null {
  if (total <= shown || shown === 0) return null;
  return `${top + 1}–${Math.min(total, top + shown)} of ${total}`;
}
