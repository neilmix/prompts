const ID_RE = /^\d{8}-\d{6}(-([2-9]|[1-9]\d+))?$/;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function formatId(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

export function nextFreeId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
}
