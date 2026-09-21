import { spawn } from 'node:child_process';

/** Run the editor shell command with `file` appended, attached to the terminal. */
export function runEditor(command: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', `${command} "$@"`, 'sh', file], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', () => resolve());
  });
}
