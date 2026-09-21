import { spawn } from 'node:child_process';

/** Run `argv` with `file` appended, attached to the terminal. Resolves on exit. */
export function runEditor(argv: string[], file: string): Promise<void> {
  const [cmd, ...args] = argv;
  if (!cmd) return Promise.reject(new Error('no editor configured'));
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args, file], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', () => resolve());
  });
}
