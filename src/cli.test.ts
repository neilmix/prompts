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

  describe('flags', () => {
    const cli = (args: string[], input?: string) =>
      spawnSync('node', ['--import', 'tsx', 'src/cli.tsx', ...args], { encoding: 'utf8', input });
    const store = () => {
      const dir = path.join(ROOT, 'store');
      fs.mkdirSync(path.join(dir, '.prompts', 'index'), { recursive: true });
      fs.mkdirSync(path.join(dir, '.prompts', 'text'));
      fs.writeFileSync(path.join(dir, '.prompts', 'settings.txt'), '');
      fs.writeFileSync(path.join(dir, '.prompts', 'sort.txt'), '');
      return dir;
    };

    it('creates, writes, shows, and lists without a terminal', () => {
      const dir = store();
      const c = cli([dir, '--create', '--title', 'First', '--tags=a,b'], 'hello');
      expect(c.stderr).toBe('');
      expect(c.status).toBe(0);
      const id = c.stdout.trim();
      expect(id).toMatch(/^\d{8}-\d{6}$/);
      expect(cli([`--show=${id}`, dir]).stdout).toBe('hello');
      expect(cli([dir, `--write=${id}`], 'bye\n').status).toBe(0);
      expect(cli([dir, '--show', id]).stdout).toBe('bye\n');
      expect(cli([dir, '--list', '--filter=B']).stdout).toBe(`${id}\tFirst\ta,b\n`);
    });

    it('exits quietly when the reader closes the pipe early', () => {
      const dir = store();
      const id = cli([dir, '--create', '--title=Big'], 'x'.repeat(4_000_000)).stdout.trim();
      const r = spawnSync('sh', ['-c', `node --import tsx src/cli.tsx "$0" --show=${id} | head -c 1 >/dev/null`, dir], {
        encoding: 'utf8',
      });
      expect(r.stderr).toBe('');
    });

    it('defaults to the current directory', () => {
      const dir = store();
      const r = spawnSync('node', ['--import', 'tsx', path.resolve('src/cli.tsx'), '--list'], { encoding: 'utf8', cwd: dir });
      expect(r).toMatchObject({ status: 0, stdout: '', stderr: '' });
    });

    it('prints help', () => {
      const r = cli(['--help']);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^Usage:/);
    });

    it('exits 2 on usage errors and 1 on bad input', () => {
      const dir = store();
      const u = cli([dir, '--list', '--title=x']);
      expect(u.status).toBe(2);
      expect(u.stderr).toBe('--title requires --create\nRun prompts --help for usage.\n');
      const b = cli([dir, '--show=20990101-000000']);
      expect(b.status).toBe(1);
      expect(b.stderr).toBe('no prompt with id "20990101-000000"\n');
    });

    it('does not set up a missing .prompts', () => {
      const dir = path.join(ROOT, 'empty');
      fs.mkdirSync(dir);
      const r = cli([dir, '--create', '--title=x'], '');
      expect(r.status).toBe(1);
      expect(fs.existsSync(path.join(dir, '.prompts'))).toBe(false);
    });
  });
});
