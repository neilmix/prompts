import { spawn } from 'node:child_process';

export const CLIPBOARD_COMMANDS: string[][] = [
  ['pbcopy'],
  ['wl-copy'],
  ['xclip', '-selection', 'clipboard'],
  ['xsel', '--clipboard', '--input'],
];

/** Copy `text` using the first clipboard command that runs. */
export async function copyToClipboard(text: string, commands = CLIPBOARD_COMMANDS): Promise<void> {
  for (const [cmd, ...args] of commands) {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(cmd!, args, { stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
      child.stdin.on('error', () => undefined);
      child.stdin.end(text);
    });
    if (ok) return;
  }
  throw new Error('no clipboard command available (pbcopy, wl-copy, xclip, xsel)');
}
