import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { KEYS } from '../test/keys.js';
import { Setup, SETUP_QUESTION } from './Setup.js';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('Setup', () => {
  it('shows the directory and question', () => {
    const inst = render(<Setup dir="/some/dir" onAnswer={() => undefined} />);
    const frame = (inst.lastFrame() ?? '').replace(/\x1b\[[0-9;]*m/g, '');
    expect(frame).toContain('/some/dir');
    expect(frame).toContain(`${SETUP_QUESTION} (y/n)`);
    inst.unmount();
  });

  it.each([
    ['y', true],
    ['Y', true],
    ['n', false],
    [KEYS.escape, false],
    [KEYS.ctrl('c'), false],
  ])('answers %j with %s', async (key, expected) => {
    const answers: boolean[] = [];
    const inst = render(<Setup dir="/d" onAnswer={(v) => answers.push(v)} />);
    inst.stdin.write(key);
    await tick(40);
    expect(answers).toEqual([expected]);
    inst.unmount();
  });

  it('ignores other keys', async () => {
    const answers: boolean[] = [];
    const inst = render(<Setup dir="/d" onAnswer={(v) => answers.push(v)} />);
    inst.stdin.write('x');
    await tick();
    expect(answers).toEqual([]);
    inst.unmount();
  });
});
