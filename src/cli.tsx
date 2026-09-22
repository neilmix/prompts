#!/usr/bin/env node
import { render } from 'ink';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runEditor } from './editor.js';
import { realFs } from './store/fs.js';
import { initStore, loadStore, openStore, type Store } from './store/open.js';
import { App, type ExitResult } from './ui/App.js';
import { MOUSE_OFF, MOUSE_ON } from './ui/keys.js';
import { Setup } from './ui/Setup.js';

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const dir = path.resolve(argv[0] ?? process.cwd());
  const isTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let store: Store;
  const result = openStore(realFs, dir);
  if (result.ok) store = result.store;
  else if ('errors' in result) {
    process.stderr.write(result.errors.map((e) => `${e}\n`).join(''));
    return 1;
  } else {
    if (!isTty) return needTty();
    const setup = render(<Setup dir={dir} />, { exitOnCtrlC: false });
    const yes = (await setup.waitUntilExit()) === true;
    if (!yes) return 0;
    initStore(realFs, result.paths);
    const loaded = loadStore(realFs, result.paths);
    if (!loaded.ok) {
      process.stderr.write(loaded.errors.map((e) => `${e}\n`).join(''));
      return 1;
    }
    store = loaded.store;
  }
  if (!isTty) return needTty();
  // The editor owns the terminal while it runs; leaving mouse reporting on
  // would feed it mouse sequences.
  const editor = async (command: string, file: string) => {
    process.stdout.write(MOUSE_OFF);
    try {
      await runEditor(command, file);
    } finally {
      process.stdout.write(MOUSE_ON);
    }
  };
  const instance = render(<App fs={realFs} store={store} env={env} runEditor={editor} />, {
    exitOnCtrlC: false,
    alternateScreen: true,
  });
  process.stdout.write(MOUSE_ON);
  let outcome: ExitResult | undefined;
  try {
    outcome = (await instance.waitUntilExit()) as ExitResult | undefined;
  } finally {
    process.stdout.write(MOUSE_OFF);
  }
  if (outcome && outcome.deleted > 0) {
    process.stdout.write(`Deleted ${outcome.deleted} prompt${outcome.deleted === 1 ? '' : 's'}.\n`);
  }
  return 0;
}

function needTty(): number {
  process.stderr.write('prompts needs an interactive terminal\n');
  return 1;
}

/** True when this file is the script Node was started with, even through a symlinked bin. */
function isEntry(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return import.meta.url === new URL(`file://${fs.realpathSync(script)}`).href;
  } catch {
    return false;
  }
}

if (isEntry()) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
