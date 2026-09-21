import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve('tmp/cli-test');
const run = (dir: string) =>
  spawnSync('node', ['--import', 'tsx', 'src/cli.tsx', dir], { encoding: 'utf8', env: { ...process.env, CI: '1' } });

describe('cli startup', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
  });
  afterEach(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  it('needs a terminal to offer setup for a directory without .prompts', () => {
    const dir = path.join(ROOT, 'busy');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'x.txt'), '');
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe('prompts needs an interactive terminal\n');
    expect(fs.existsSync(path.join(dir, '.prompts'))).toBe(false);
  });

  it('runs when started through a symlink, as npm link does', () => {
    fs.mkdirSync(path.join(ROOT, 'bin'));
    const link = path.join(ROOT, 'bin', 'prompts.tsx');
    fs.symlinkSync(path.resolve('src/cli.tsx'), link);
    const dir = path.join(ROOT, 'empty');
    fs.mkdirSync(dir);
    const r = spawnSync('node', ['--import', 'tsx', link, dir], { encoding: 'utf8' });
    expect(r.stderr).toBe('prompts needs an interactive terminal\n');
    expect(r.status).toBe(1);
  });

  it('refuses a non-terminal', () => {
    const dir = path.join(ROOT, 'empty');
    fs.mkdirSync(dir);
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe('prompts needs an interactive terminal\n');
  });

  it('refuses a missing directory', () => {
    const r = run(path.join(ROOT, 'nope'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a directory/);
  });

  it('reports validation errors and exits', () => {
    const dir = path.join(ROOT, 'bad');
    fs.mkdirSync(path.join(dir, '.prompts', 'index'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.prompts', 'text'));
    fs.writeFileSync(path.join(dir, '.prompts', 'settings.txt'), 'nope: 1\n');
    fs.writeFileSync(path.join(dir, '.prompts', 'sort.txt'), '');
    fs.writeFileSync(path.join(dir, '.prompts', 'index', '20260101-000000.txt'), 'tags: a\n');
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe('settings.txt: unknown key "nope"\nindex/20260101-000000.txt: missing title\n');
  });
});
