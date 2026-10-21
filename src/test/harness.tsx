import { render } from 'ink-testing-library';
import { MemoryFs } from '../store/fs.js';
import { openStore, type Store } from '../store/open.js';
import { App, type AppProps, type ExitResult } from '../ui/App.js';

export interface Harness {
  fs: MemoryFs;
  store: Store;
  frame: () => string;
  press: (...keys: string[]) => Promise<void>;
  unmount: () => void;
  /** `<command> <file>` per editor run; the fake editor writes `edited`. */
  edits: string[];
  /** What the editor found in the file, per run. */
  opened: string[];
  copies: string[];
  exit: () => ExitResult | undefined;
}

export const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Render the app over an in-memory store rooted at /w. */
export async function mount(
  files: Record<string, string> = {},
  opts: { rows?: number; columns?: number; now?: () => Date; env?: Record<string, string>; copyFails?: boolean; editorWrites?: string } = {},
): Promise<Harness> {
  const fs = new MemoryFs({
    '/w/.prompts/items': null,
    '/w/.prompts/archive': null,
    '/w/.prompts/VERSION': '1\n',
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': '',
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
  });
  const result = openStore(fs, '/w');
  if (!result.ok) throw new Error('errors' in result ? result.errors.join('\n') : 'not ok');
  const edits: string[] = [];
  const opened: string[] = [];
  const copies: string[] = [];
  let exitValue: ExitResult | undefined;
  const props: AppProps = {
    fs,
    store: result.store,
    env: opts.env ?? {},
    runEditor: async (command, file) => {
      edits.push(`${command} ${file}`);
      opened.push(fs.readFile(file));
      fs.writeFile(file, opts.editorWrites ?? 'edited');
    },
    copy: async (text) => {
      if (opts.copyFails) throw new Error('no clipboard');
      copies.push(text);
    },
    size: { rows: opts.rows ?? 12, columns: opts.columns ?? 40 },
    now: opts.now ?? (() => new Date(2026, 8, 21, 14, 30, 5)),
  };
  const inst = render(<App {...props} onExit={(v) => (exitValue = v)} />);
  await tick();
  return {
    fs,
    store: result.store,
    edits,
    opened,
    copies,
    exit: () => exitValue,
    frame: () => inst.lastFrame() ?? '',
    press: async (...keys) => {
      for (const k of keys) {
        inst.stdin.write(k);
        await tick(k === '\x1b' ? 40 : 5);
      }
    },
    unmount: () => inst.unmount(),
  };
}

/** Frame with ANSI stripped, trailing spaces trimmed. */
export function plain(frame: string): string {
  return frame
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n');
}
