#!/usr/bin/env node
import { render } from 'ink';
import * as path from 'node:path';
import { runEditor } from './editor.js';
import { realFs } from './store/fs.js';
import { openStore } from './store/open.js';
import { App, type ExitResult } from './ui/App.js';
import { MOUSE_OFF, MOUSE_ON } from './ui/keys.js';

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const dir = path.resolve(argv[0] ?? process.cwd());
  const result = openStore(realFs, dir);
  if (!result.ok) {
    process.stderr.write(result.errors.map((e) => `${e}\n`).join(''));
    return 1;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('prompts needs an interactive terminal\n');
    return 1;
  }
  const editor = async (command: string, file: string) => {
    process.stdout.write(MOUSE_OFF);
    try {
      await runEditor(command, file);
    } finally {
      process.stdout.write(MOUSE_ON);
    }
  };
  const instance = render(<App fs={realFs} store={result.store} env={env} runEditor={editor} />, {
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

const isEntry = process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (isEntry) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
