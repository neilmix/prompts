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

export interface Block {
  item: number;
  lines: string[];
  start: number;
}

/** Lay out items as wrapped blocks separated by `gap` blank lines. */
export function layoutBlocks(items: readonly string[], width: number, gap = 1): Block[] {
  let start = 0;
  return items.map((text, item) => {
    const lines = wrapText(text, width);
    const block = { item, lines, start };
    start += lines.length + gap;
    return block;
  });
}

/** Scroll `top` the minimum needed so [start, end) is inside a `height`-line window. */
export function scrollToShow(top: number, start: number, end: number, height: number, total: number): number {
  let t = top;
  if (start < t) t = start;
  else if (end > t + height) t = end - height;
  return Math.max(0, Math.min(t, Math.max(0, total - height)));
}
