import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve('tmp/editor-test');

// Reads stdin the way Ink does, detaches as Ink's suspendTerminal does, runs
// the editor, then prints whatever input this process took for itself.
const PARENT = `
import { runEditor } from '../../src/editor.js';
const onReadable = () => { while (process.stdin.read() !== null); };
process.stdin.setEncoding('utf8');
process.stdin.on('readable', onReadable);
setTimeout(async () => {
  process.stdin.removeListener('readable', onReadable);
  process.stdout.write('ready\\n');
  await runEditor(process.argv[2], process.argv[3]);
  let taken = '';
  let chunk;
  while ((chunk = process.stdin.read()) !== null) taken += chunk;
  process.stdout.write(JSON.stringify(taken));
  process.exit(0);
}, 100);
`;

// An editor that reads its input slowly, one byte at a time, as an editor
// busy redrawing during a paste does.
const SLOW_EDITOR = `#!/bin/sh
i=0
while [ $i -lt 20 ]; do
  dd bs=1 count=1 2>/dev/null
  sleep 0.02
  i=$((i+1))
done > "$1"
`;

describe('runEditor', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'parent.ts'), PARENT);
    fs.writeFileSync(path.join(ROOT, 'editor.sh'), SLOW_EDITOR, { mode: 0o755 });
  });
  afterEach(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  it('leaves all input to the editor while it runs, so pastes are not split', async () => {
    const file = path.join(ROOT, 'out.md');
    const child = spawn('node', ['--import', 'tsx', path.join(ROOT, 'parent.ts'), path.join(ROOT, 'editor.sh'), file], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      out += d;
      // A paste arriving in one burst after the editor has started.
      if (out === 'ready\n') setTimeout(() => child.stdin.end('\x1b[200~pasted\x1b[201~'), 200);
    });
    await new Promise((resolve) => child.on('exit', resolve));
    expect(out).toBe('ready\n""');
    expect(fs.readFileSync(file, 'utf8')).toBe('\x1b[200~pasted\x1b[201~');
  }, 15_000);
});
