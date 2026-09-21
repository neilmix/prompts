export type Settings = Record<string, string>;

const KEY_RE = /^[A-Za-z0-9_-]+$/;

/** Parse the `key: value` settings syntax. Throws on malformed input. */
export function parseSettings(text: string): Settings {
  const out: Settings = {};
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.trim() === '') return;
    const lineNo = i + 1;
    const idx = line.indexOf(':');
    if (idx <= 0) throw new Error(`line ${lineNo}: expected "key: value"`);
    const key = line.slice(0, idx);
    const rest = line.slice(idx + 1);
    if (!KEY_RE.test(key)) throw new Error(`line ${lineNo}: invalid key "${key}"`);
    if (rest !== '' && !rest.startsWith(' ')) {
      throw new Error(`line ${lineNo}: expected a space after ":"`);
    }
    if (key in out) throw new Error(`line ${lineNo}: duplicate key "${key}"`);
    out[key] = rest.trim();
  });
  return out;
}

export function serializeSettings(settings: Settings): string {
  return Object.entries(settings)
    .map(([k, v]) => `${k}: ${v}\n`)
    .join('');
}
