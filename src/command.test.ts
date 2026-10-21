import { describe, expect, it } from 'vitest';
import { HELP, parseArgs, runCommand } from './command.js';
import { MemoryFs } from './store/fs.js';
import { README_V0 } from './store/upgrade.js';

const A = '20260101-000000';
const B = '20260102-000000';
const C = '20260103-000000';
const OLD = '20250101-000000';
const NOW = new Date(2026, 8, 21, 14, 30, 5);

function storeFs(files: Record<string, string> = {}): MemoryFs {
  return new MemoryFs({
    '/w/.prompts/items': null,
    '/w/.prompts/archive': null,
    '/w/.prompts/VERSION': '1\n',
    '/w/.prompts/settings.txt': '',
    '/w/.prompts/sort.txt': '',
    ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/w/.prompts/${k}`, v])),
  });
}

const THREE = {
  [`items/${A}.md`]: 'title: Alpha\ntags: work, Urgent\n\n\nalpha text\n',
  [`items/${B}.md`]: 'title: Beta\ntags: work\n\n\n',
  [`items/${C}.md`]: 'title: Gamma\n\n\nmentions code review here',
  [`archive/${OLD}.md`]: 'title: Old one\ntags: legacy\n\n\nold text',
  'sort.txt': `${B}\n${A}\n`,
};

/** Parse argv and run it against /w; usage errors come back as code 2. */
async function run(fs: MemoryFs, argv: string[], stdin = '') {
  const parsed = parseArgs(argv);
  if ('error' in parsed) return { code: 2, stdout: '', stderr: parsed.error };
  if (!parsed.command) throw new Error('no command');
  return runCommand(fs, '/w', parsed.command, async () => stdin, NOW);
}

const file = (fs: MemoryFs, rel: string) => fs.readFile(`/w/.prompts/${rel}`);

describe('parseArgs', () => {
  const ok = (argv: string[]) => {
    const r = parseArgs(argv);
    if ('error' in r) throw new Error(r.error);
    return r;
  };
  const error = (argv: string[]) => {
    const r = parseArgs(argv);
    return 'error' in r ? r.error : null;
  };

  it('no flags is interactive, with an optional directory', () => {
    expect(ok([])).toEqual({ dir: undefined, command: null });
    expect(ok(['d'])).toEqual({ dir: 'd', command: null });
  });

  it('parses commands, their values and options, with = or a separate value', () => {
    expect(ok(['--list']).command).toEqual({ name: 'list', arg: '', options: {} });
    expect(ok(['d', '--list', '--search=a "b c"']).command).toEqual({ name: 'list', arg: '', options: { search: 'a "b c"' } });
    expect(ok(['--show', A]).command).toEqual({ name: 'show', arg: A, options: {} });
    expect(ok([`--write=${A}`, 'd'])).toEqual({ dir: 'd', command: { name: 'write', arg: A, options: {} } });
    expect(ok(['--create', '--title', 'T', '--tags=x']).command).toEqual({ name: 'create', arg: '', options: { title: 'T', tags: 'x' } });
    expect(ok(['--move', A, '--to', '3']).command).toEqual({ name: 'move', arg: A, options: { to: '3' } });
    expect(ok(['--set=editor=vi']).command).toEqual({ name: 'set', arg: 'editor=vi', options: {} });
  });

  it('help wins over everything else', () => {
    expect(ok(['--list', '--help', '--show=x', 'a', 'b']).command).toEqual({ name: 'help', arg: '', options: {} });
  });

  it('names the commands an option belongs to, and missing required options', () => {
    expect(error(['--title=T'])).toBe('--title requires --create or --retitle');
    expect(error(['--list', '--tags=a'])).toBe('--tags requires --create or --tag or --untag');
    expect(error(['--create'])).toBe('--create requires --title');
    expect(error([`--move=${A}`])).toBe('--move requires --to');
    expect(error(['--list', '--show', A])).toBe('use only one of --list, --show');
    expect(error(['--filter=a'])).toMatch(/Unknown option '--filter'/);
  });

  it('rejects bad combinations', () => {
    for (const argv of [['--bogus'], ['--search=a'], ['--show', A, '--search=a'], ['--show'], ['a', 'b'], ['--list', 'a', 'b'], ['--tag=x']]) {
      expect(error(argv), argv.join(' ')).not.toBeNull();
    }
  });
});

describe('help', () => {
  it('prints usage that covers every flag', async () => {
    expect(await run(storeFs(), ['--help'])).toEqual({ code: 0, stdout: HELP, stderr: '' });
    for (const flag of ['list', 'search', 'show', 'write', 'create', 'title', 'tags', 'retitle', 'tag', 'untag', 'move', 'to', 'archive', 'restore', 'list-archive', 'settings', 'set', 'init', 'upgrade', 'help']) {
      expect(HELP).toContain(`--${flag}`);
    }
    expect(HELP).toContain('  prompts [dir] --create --title=TITLE [--tags=TAGS]  < content');
  });
});

describe('store states', () => {
  it('fails without .prompts and creates nothing', async () => {
    const fs = new MemoryFs({ '/w': null });
    const r = await run(fs, ['--list']);
    expect(r).toEqual({ code: 1, stdout: '', stderr: '/w: no .prompts directory; run prompts --init, or prompts in a terminal, to set one up\n' });
    expect(fs.exists('/w/.prompts')).toBe(false);
  });

  it('reports validation errors', async () => {
    const r = await run(storeFs({ 'settings.txt': 'x: 1\n' }), ['--list']);
    expect(r).toEqual({ code: 1, stdout: '', stderr: 'settings.txt: unknown key "x"\n' });
  });

  it('refuses a version 0 store, changing nothing', async () => {
    const fs = new MemoryFs({ '/w/.prompts/index': null, '/w/.prompts/sort.txt': '' });
    const before = new Map(fs.files);
    expect(await run(fs, ['--list'])).toEqual({
      code: 1,
      stdout: '',
      stderr: '/w: .prompts is in an older format; run prompts --upgrade, or prompts in a terminal, to upgrade it\n',
    });
    expect(fs.files).toEqual(before);
  });

  it('--init creates .prompts once', async () => {
    const fs = new MemoryFs({ '/w': null });
    expect(await run(fs, ['--init'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(file(fs, 'VERSION')).toBe('1\n');
    expect(await run(fs, ['--list'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await run(fs, ['--init'])).toEqual({ code: 1, stdout: '', stderr: '/w/.prompts: already exists\n' });
    expect(await run(new MemoryFs(), ['--init'])).toMatchObject({ code: 1, stderr: '/w: not a directory\n' });
  });

  it('--upgrade converts version 0 and is a no-op when current', async () => {
    const fs = new MemoryFs({
      '/w/.prompts/index/20260101-000000.txt': 'title: Old\n',
      '/w/.prompts/text/20260101-000000.txt': 'body',
      '/w/.prompts/settings.txt': '',
      '/w/.prompts/sort.txt': '',
      '/w/.prompts/README.md': README_V0,
    });
    expect(await run(fs, ['--upgrade'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(file(fs, `items/${A}.md`)).toBe('title: Old\n\n\nbody');
    expect(await run(fs, ['--upgrade'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await run(new MemoryFs({ '/w': null }), ['--upgrade'])).toMatchObject({ code: 1 });
  });

  it('--upgrade reports invalid version 0 files', async () => {
    const fs = new MemoryFs({ '/w/.prompts/index/20260101-000000.txt': 'tags: x\n' });
    expect(await run(fs, ['--upgrade'])).toEqual({ code: 1, stdout: '', stderr: 'index/20260101-000000.txt: missing title\n' });
  });
});

describe('list and show', () => {
  it('lists in display order as tab-separated lines', async () => {
    expect(await run(storeFs(THREE), ['--list'])).toEqual({
      code: 0,
      stdout: `${C}\tGamma\t\n${B}\tBeta\twork\n${A}\tAlpha\twork,Urgent\n`,
      stderr: '',
    });
    expect(await run(storeFs(), ['--list'])).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('searches titles, text and tags; terms are ANDed; quotes keep phrases', async () => {
    const list = async (search: string) => (await run(storeFs(THREE), ['--list', `--search=${search}`])).stdout;
    expect(await list('WORK')).toBe(`${B}\tBeta\twork\n${A}\tAlpha\twork,Urgent\n`);
    expect(await list('work urg')).toBe(`${A}\tAlpha\twork,Urgent\n`);
    expect(await list('"code review"')).toBe(`${C}\tGamma\t\n`);
    expect(await list('"review code"')).toBe('');
    expect(await list('legacy')).toBe('');
  });

  it('lists the archive newest first, searchable', async () => {
    const fs = storeFs({ ...THREE, 'archive/20240101-000000.md': 'title: Older\n' });
    expect((await run(fs, ['--list-archive'])).stdout).toBe(`${OLD}\tOld one\tlegacy\n20240101-000000\tOlder\t\n`);
    expect((await run(fs, ['--list-archive', '--search=old text'])).stdout).toBe(`${OLD}\tOld one\tlegacy\n`);
  });

  it('shows text verbatim, archived too', async () => {
    expect(await run(storeFs(THREE), ['--show', A])).toEqual({ code: 0, stdout: 'alpha text\n', stderr: '' });
    expect(await run(storeFs(THREE), ['--show', B])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await run(storeFs(THREE), ['--show', OLD])).toEqual({ code: 0, stdout: 'old text', stderr: '' });
  });

  it('rejects unknown ids, and archived ones where an active prompt is needed', async () => {
    for (const argv of [['--show=20990101-000000'], ['--write=20990101-000000'], ['--archive=20990101-000000']]) {
      expect(await run(storeFs(THREE), argv)).toEqual({ code: 1, stdout: '', stderr: 'no prompt with id "20990101-000000"\n' });
    }
    for (const argv of [[`--write=${OLD}`], [`--retitle=${OLD}`, '--title=x'], [`--tag=${OLD}`, '--tags=x'], [`--move=${OLD}`, '--to=1'], [`--archive=${OLD}`]]) {
      expect(await run(storeFs(THREE), argv)).toEqual({ code: 1, stdout: '', stderr: `prompt "${OLD}" is archived; restore it first\n` });
    }
    expect(await run(storeFs(THREE), [`--restore=${A}`])).toEqual({ code: 1, stdout: '', stderr: `no archived prompt with id "${A}"\n` });
  });
});

describe('changes', () => {
  it('writes stdin verbatim, keeping the header', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, [`--write=${B}`], 'new\ttext')).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(file(fs, `items/${B}.md`)).toBe('title: Beta\ntags: work\n\n\nnew\ttext');
  });

  it('creates first in sort order and prints the id', async () => {
    const fs = storeFs(THREE);
    const r = await run(fs, ['--create', '--title= New\tone ', '--tags=WORK,fresh,Fresh'], 'body');
    const id = '20260921-143005';
    expect(r).toEqual({ code: 0, stdout: `${id}\n`, stderr: '' });
    expect(file(fs, `items/${id}.md`)).toBe('title: New one\ntags: work, fresh\n\n\nbody');
    expect(file(fs, 'sort.txt')).toBe(`${id}\n${C}\n${B}\n${A}\n`);
  });

  it('rejects bad titles and tags without writing', async () => {
    const cases: [string[], string][] = [
      [['--create', '--title= \t '], '--title: title is empty'],
      [['--create', '--title=a\nb'], '--title: titles may not contain line breaks'],
      [['--create', '--title=T', '--tags=ok,no.pe'], '--tags: "no.pe": tags use only letters, numbers, - and _'],
      [[`--retitle=${A}`, '--title='], '--title: title is empty'],
      [[`--tag=${A}`, '--tags=a b'], '--tags: "a b": tags use only letters, numbers, - and _'],
      [[`--tag=${A}`, '--tags=,'], '--tags: no tags given'],
      [[`--move=${A}`, '--to=0'], '--to: "0": expected a position, 1 or more'],
      [[`--move=${A}`, '--to=x'], '--to: "x": expected a position, 1 or more'],
      [['--set=editor'], '--set: "editor": expected KEY=VALUE'],
      [['--set=color=red'], '--set: unknown setting "color"'],
    ];
    for (const [argv, err] of cases) {
      const fs = storeFs(THREE);
      const before = new Map(fs.files);
      expect(await run(fs, argv), argv.join(' ')).toEqual({ code: 1, stdout: '', stderr: `${err}\n` });
      expect(fs.files).toEqual(before);
    }
  });

  it('retitles, tags and untags', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, [`--retitle=${C}`, '--title=Gamma\t2'])).toEqual({ code: 0, stdout: '', stderr: '' });
    await run(fs, [`--tag=${C}`, '--tags=urgent,new,NEW']);
    expect(file(fs, `items/${C}.md`)).toBe('title: Gamma 2\ntags: Urgent, new\n\n\nmentions code review here');
    await run(fs, [`--untag=${C}`, '--tags=URGENT,absent']);
    expect(file(fs, `items/${C}.md`)).toBe('title: Gamma 2\ntags: new\n\n\nmentions code review here');
  });

  it('moves to a position', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, [`--move=${A}`, '--to=1'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect((await run(fs, ['--list'])).stdout.split('\n')[0]).toMatch(new RegExp(`^${A}`));
    await run(fs, [`--move=${A}`, '--to=99']);
    expect(file(fs, 'sort.txt')).toBe(`${C}\n${B}\n${A}\n`);
  });

  it('archives and restores', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, [`--archive=${B}`])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(fs.exists(`/w/.prompts/archive/${B}.md`)).toBe(true);
    expect(file(fs, 'sort.txt')).toBe(`${C}\n${A}\n`);
    expect(await run(fs, [`--restore=${OLD}`])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(file(fs, 'sort.txt')).toBe(`${OLD}\n${C}\n${A}\n`);
    expect(file(fs, `items/${OLD}.md`)).toBe('title: Old one\ntags: legacy\n\n\nold text');
  });

  it('prints and changes settings', async () => {
    const fs = storeFs(THREE);
    expect(await run(fs, ['--settings'])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await run(fs, ['--set', 'editor= code --wait '])).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(await run(fs, ['--settings'])).toEqual({ code: 0, stdout: 'editor: code --wait\n', stderr: '' });
    await run(fs, ['--set=editor=']);
    expect(file(fs, 'settings.txt')).toBe('');
  });

  it('reports filesystem errors', async () => {
    const fs = storeFs(THREE);
    fs.writeFile = () => {
      throw new Error('disk full');
    };
    expect(await run(fs, [`--retitle=${A}`, '--title=x'])).toEqual({ code: 1, stdout: '', stderr: 'disk full\n' });
  });
});
