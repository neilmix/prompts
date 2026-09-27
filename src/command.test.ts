import { describe, expect, it } from 'vitest';
import { HELP, parseArgs, runCommand, type Command } from './command.js';
import { MemoryFs } from './store/fs.js';

const A = '20260101-000000';
const B = '20260102-000000';
const C = '20260103-000000';
const NOW = new Date(2026, 8, 21, 14, 30, 5);

function storeFs(files: Record<string, string> = {}): MemoryFs {
  return new MemoryFs({
    '/w/.prompts/index': null,
    '/w/.prompts/text': null,
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': '',
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
  });
}

const THREE = {
  [`index/${A}.txt`]: 'title: Alpha\ntags: work, Urgent\n',
  [`index/${B}.txt`]: 'title: Beta\ntags: work\n',
  [`index/${C}.txt`]: 'title: Gamma\n',
  [`text/${A}.txt`]: 'alpha text\n',
  'sort.txt': `${B}\n${A}\n`,
};

function run(fs: MemoryFs, command: Command, stdin = '') {
  return runCommand(fs, '/w', command, async () => stdin, NOW);
}

describe('parseArgs', () => {
  const ok = (argv: string[]) => {
    const r = parseArgs(argv);
    if ('error' in r) throw new Error(r.error);
    return r;
  };

  it('no flags is interactive, with an optional directory', async () => {
    expect(ok([])).toEqual({ dir: undefined, command: null });
    expect(ok(['d'])).toEqual({ dir: 'd', command: null });
  });

  it('parses each command, with = or a separate value', async () => {
    expect(ok(['--help']).command).toEqual({ kind: 'help' });
    expect(ok(['--list']).command).toEqual({ kind: 'list', filter: [] });
    expect(ok(['d', '--list', '--filter=a, b,,']).command).toEqual({ kind: 'list', filter: ['a', 'b'] });
    expect(ok(['--show', A]).command).toEqual({ kind: 'show', id: A });
    expect(ok([`--write=${A}`, 'd'])).toEqual({ dir: 'd', command: { kind: 'write', id: A } });
    expect(ok(['--create', '--title', 'T']).command).toEqual({ kind: 'create', title: 'T', tags: [] });
    expect(ok(['--create', '--title=T', '--tags=x,y']).command).toEqual({ kind: 'create', title: 'T', tags: ['x', 'y'] });
  });

  it('help wins over everything else', async () => {
    expect(ok(['--list', '--help', '--show=x', 'a', 'b']).command).toEqual({ kind: 'help' });
  });

  it('rejects bad combinations', async () => {
    for (const argv of [
      ['--bogus'],
      ['--list', '--show', A],
      ['--filter=a'],
      ['--show', A, '--filter=a'],
      ['--title=T'],
      ['--tags=a'],
      ['--list', '--tags=a'],
      ['--create'],
      ['--show'],
      ['a', 'b'],
      ['--list', 'a', 'b'],
    ]) {
      expect('error' in parseArgs(argv), argv.join(' ')).toBe(true);
    }
  });
});

describe('runCommand', () => {
  it('help prints usage', async () => {
    expect(await run(storeFs(), { kind: 'help' })).toEqual({ code: 0, stdout: HELP, stderr: '' });
  });

  it('fails without .prompts and creates nothing', async () => {
    const fs = new MemoryFs({ '/w': null });
    const r = await run(fs, { kind: 'list', filter: [] });
    expect(r.code).toBe(1);
    expect(r.stderr).toBe('/w: no .prompts directory; run prompts in a terminal to set one up\n');
    expect(fs.exists('/w/.prompts')).toBe(false);
  });

  it('reports validation errors', async () => {
    const r = await run(storeFs({ 'settings.txt': 'x: 1\n' }), { kind: 'list', filter: [] });
    expect(r).toEqual({ code: 1, stdout: '', stderr: 'settings.txt: unknown key "x"\n' });
  });

  it('lists in display order as tab-separated lines', async () => {
    const r = await run(storeFs(THREE), { kind: 'list', filter: [] });
    expect(r).toEqual({
      code: 0,
      stdout: `${C}\tGamma\t\n${B}\tBeta\twork\n${A}\tAlpha\twork,Urgent\n`,
      stderr: '',
    });
  });

  it('lists nothing for an empty store', async () => {
    expect(await run(storeFs(), { kind: 'list', filter: [] })).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('filters by every tag, case-insensitively', async () => {
    const list = async (filter: string[]) => (await run(storeFs(THREE), { kind: 'list', filter })).stdout;
    expect(await list(['WORK'])).toBe(`${B}\tBeta\twork\n${A}\tAlpha\twork,Urgent\n`);
    expect(await list(['work', 'urgent'])).toBe(`${A}\tAlpha\twork,Urgent\n`);
    expect(await list(['nope'])).toBe('');
  });

  it('rejects invalid filter tags', async () => {
    const r = await run(storeFs(THREE), { kind: 'list', filter: ['a b'] });
    expect(r).toEqual({
      code: 1,
      stdout: '',
      stderr: '--filter: "a b": tags use only letters, numbers, - and _\n',
    });
  });

  it('shows text verbatim; missing text is empty', async () => {
    expect(await run(storeFs(THREE), { kind: 'show', id: A })).toEqual({ code: 0, stdout: 'alpha text\n', stderr: '' });
    expect(await run(storeFs(THREE), { kind: 'show', id: B })).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('rejects unknown ids', async () => {
    for (const kind of ['show', 'write'] as const) {
      const r = await run(storeFs(THREE), { kind, id: '20990101-000000' });
      expect(r).toEqual({ code: 1, stdout: '', stderr: 'no prompt with id "20990101-000000"\n' });
    }
  });

  it('writes stdin verbatim', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, { kind: 'write', id: B }, 'new\ttext')).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(fs.readFile(`/w/.prompts/text/${B}.txt`)).toBe('new\ttext');
  });

  it('creates first in sort order and prints the id', async () => {
    const fs = storeFs(THREE);
    const r = await run(fs, { kind: 'create', title: ' New\tone ', tags: ['WORK', 'fresh', 'Fresh'] }, 'body');
    const id = '20260921-143005';
    expect(r).toEqual({ code: 0, stdout: `${id}\n`, stderr: '' });
    expect(fs.readFile(`/w/.prompts/index/${id}.txt`)).toBe('title: New one\ntags: work, fresh\n');
    expect(fs.readFile(`/w/.prompts/text/${id}.txt`)).toBe('body');
    expect(fs.readFile('/w/.prompts/sort.txt')).toBe(`${id}\n${C}\n${B}\n${A}\n`);
  });

  it('rejects bad titles and tags without writing', async () => {
    const cases: [Command, string][] = [
      [{ kind: 'create', title: ' \t ', tags: [] }, '--title: title is empty'],
      [{ kind: 'create', title: 'a\nb', tags: [] }, '--title: titles may not contain line breaks'],
      [
        { kind: 'create', title: 'T', tags: ['ok', 'no,pe'] },
        '--tags: "no,pe": tags use only letters, numbers, - and _',
      ],
    ];
    for (const [cmd, err] of cases) {
      const fs = storeFs(THREE);
      const before = new Map(fs.files);
      expect(await run(fs, cmd)).toEqual({ code: 1, stdout: '', stderr: `${err}\n` });
      expect(fs.files).toEqual(before);
    }
  });
});
