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
}

export interface Viewport {
  top: number;
  total: number;
  rows: Row[];
}

/**
 * Lay out items as wrapped rows. `prefix` (e.g. a bullet) starts each item's
 * first row; continuation rows are indented by its width so wrapped text
 * lines up under the first row's text.
 */
export function layoutRows(items: readonly string[], width: number, prefix = ''): Row[] {
  const rows: Row[] = [];
  const indent = ' '.repeat(prefix.length);
  items.forEach((text, item) => {
    wrapText(text, width - prefix.length).forEach((line, i) =>
      rows.push({ text: (i === 0 ? prefix : indent) + line, item, first: i === 0 }),
    );
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
export function listViewport(items: readonly string[], selected: number, height: number, width: number, prevTop: number, prefix = ''): Viewport {
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

/** `3–9 of 42` when the content overflows, else null. */
export function rangeLabel(top: number, shown: number, total: number): string | null {
  if (total <= shown || shown === 0) return null;
  return `${top + 1}–${Math.min(total, top + shown)} of ${total}`;
}
