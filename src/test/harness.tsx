import { render } from 'ink-testing-library';
import { MemoryFs } from '../store/fs.js';
import { openStore, type Store } from '../store/open.js';
import { App, type AppProps } from '../ui/App.jsx';

export interface Harness {
  fs: MemoryFs;
  store: Store;
  frame: () => string;
  press: (...keys: string[]) => Promise<void>;
  unmount: () => void;
  edits: string[];
}

export const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Render the app over an in-memory store rooted at /w. */
export async function mount(
  files: Record<string, string> = {},
  opts: { rows?: number; columns?: number; now?: () => Date; env?: Record<string, string> } = {},
): Promise<Harness> {
  const fs = new MemoryFs({
    '/w/.prompts/index': null,
    '/w/.prompts/text': null,
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': '',
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
  });
  const opened = openStore(fs, '/w');
  if (!opened.ok) throw new Error(opened.errors.join('\n'));
  const edits: string[] = [];
  const props: AppProps = {
    fs,
    store: opened.store,
    env: opts.env ?? {},
    runEditor: async (argv, file) => {
      edits.push([...argv, file].join(' '));
      fs.writeFile(file, 'edited');
    },
    size: { rows: opts.rows ?? 12, columns: opts.columns ?? 40 },
    now: opts.now ?? (() => new Date(2026, 8, 21, 14, 30, 5)),
  };
  const inst = render(<App {...props} />);
  await tick();
  return {
    fs,
    store: opened.store,
    edits,
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
