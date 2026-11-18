import { spawnSync } from 'node:child_process';

/**
 * Run the editor shell command with `file` appended, attached to the
 * terminal. Synchronous on purpose: while the event loop runs, Node keeps
 * reading stdin even with no listener, and would take input (a paste, most
 * visibly) away from the editor. Blocking leaves every byte to the editor.
 */
export function runEditor(command: string, file: string): Promise<void> {
  const r = spawnSync('sh', ['-c', `${command} "$@"`, 'sh', file], { stdio: 'inherit' });
  return r.error ? Promise.reject(r.error) : Promise.resolve();
}
