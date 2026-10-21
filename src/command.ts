import { parseArgs as nodeParseArgs } from 'node:util';
import { archivedIds, fullOrder, matchesSearch, validateTag } from './model/select.js';
import * as ops from './ops.js';
import { serializeSettings } from './store/format.js';
import type { Fs } from './store/fs.js';
import { initStore, openStore, type Store } from './store/open.js';
import { pathsFor } from './store/paths.js';
import { parseTags, type Prompt } from './store/prompts.js';
import { SETTING_KEYS, saveSettings, type SettingKey } from './store/settings.js';
import { upgradeStore } from './store/upgrade.js';

/** A command given by flags: its name, the command flag's value, and its options. */
export interface Command {
  name: string;
  arg: string;
  options: Partial<Record<OptionName, string>>;
}

/** `command` is null when no flags were given: run the interactive app. */
export type ParsedArgs = { dir: string | undefined; command: Command | null } | { error: string };

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface Context {
  fs: Fs;
  dir: string;
  arg: string;
  options: Command['options'];
  readStdin: () => Promise<string>;
  now: Date;
}

/** Options that modify a command. Each command lists the ones it accepts. */
const OPTIONS = {
  search: 'QUERY',
  title: 'TITLE',
  tags: 'TAGS',
  to: 'N',
} as const;
type OptionName = keyof typeof OPTIONS;

type CommandDef = {
  name: string;
  /** Placeholder for the command flag's value; absent for a plain switch. */
  arg?: string;
  options?: OptionName[];
  required?: OptionName[];
  /** Reads content from stdin. */
  stdin?: boolean;
  /** Help text lines, shown indented under the usage line. */
  help: string[];
  example: string;
} & (
  | /** Runs on the opened store, which must be current. */
  { store: true; run(ctx: Context & { store: Store }): CommandResult | Promise<CommandResult> }
  /** Handles the directory itself. */
  | { store: false; run(ctx: Context): CommandResult }
);

const LIST_FORMAT = ['  ID<TAB>TITLE<TAB>TAGS', 'TAGS is comma-separated with no spaces, empty when none.'];

/** Every command. Parsing, --help and dispatch are driven by this table. */
const COMMANDS: CommandDef[] = [
  {
    name: 'list',
    options: ['search'],
    help: ['Print one line per prompt, in display order:', ...LIST_FORMAT, 'With --search, only prompts matching QUERY (see SEARCH).'],
    example: 'prompts --list --search=\'work "code review"\'',
    store: true,
    run: ({ store, options }) => ok(lines(fullOrder(store).map((id) => store.prompts.get(id)!), options.search)),
  },
  {
    name: 'show',
    arg: 'ID',
    help: ['Print the prompt\'s text exactly as stored. Works for archived', 'prompts too.'],
    example: 'prompts --show=20260921-143005',
    store: true,
    run: ({ store, arg }) => {
      const p = store.prompts.get(arg) ?? store.archived.get(arg);
      return p ? ok(p.text) : unknownId(arg);
    },
  },
  {
    name: 'write',
    arg: 'ID',
    stdin: true,
    help: ['Replace the prompt\'s text with stdin, exactly as given.'],
    example: 'echo "New text" | prompts --write=20260921-143005',
    store: true,
    run: async (ctx) => {
      const bad = activeId(ctx.store, ctx.arg);
      if (bad) return bad;
      ops.writeText(ctx.fs, ctx.store.paths, ctx.store, ctx.arg, await ctx.readStdin());
      return ok('');
    },
  },
  {
    name: 'create',
    options: ['title', 'tags'],
    required: ['title'],
    stdin: true,
    help: [
      'Create a prompt whose text is stdin and print its ID. It goes',
      'first in the display order. Tabs in TITLE become spaces. A tag',
      'that matches an existing one case-insensitively takes its spelling.',
    ],
    example: 'id=$(printf \'Summarize this.\' | prompts --create --title="Summarizer" --tags=work)',
    store: true,
    run: async (ctx) => {
      const title = ctx.options.title!;
      const problem = ops.titleProblem(title);
      if (problem) return fail(`--title: ${problem}`);
      const tags = parseTags(ctx.options.tags);
      const bad = badTag('--tags', tags);
      if (bad) return fail(bad);
      const text = await ctx.readStdin();
      const { prompt } = ops.create(ctx.fs, ctx.store.paths, ctx.store, { title, tags, text }, ctx.now);
      return ok(`${prompt.id}\n`);
    },
  },
  {
    name: 'retitle',
    arg: 'ID',
    options: ['title'],
    required: ['title'],
    help: ['Change the prompt\'s title. Tabs in TITLE become spaces.'],
    example: 'prompts --retitle=20260921-143005 --title="Better name"',
    store: true,
    run: (ctx) => {
      const problem = ops.titleProblem(ctx.options.title!);
      if (problem) return fail(`--title: ${problem}`);
      return activeId(ctx.store, ctx.arg) ?? quietly(() => ops.retitle(ctx.fs, ctx.store.paths, ctx.store, ctx.arg, ctx.options.title!));
    },
  },
  {
    name: 'tag',
    arg: 'ID',
    options: ['tags'],
    required: ['tags'],
    help: ['Add tags to the prompt. Tags it already has are skipped.'],
    example: 'prompts --tag=20260921-143005 --tags=work,urgent',
    store: true,
    run: (ctx) => {
      const tags = parseTags(ctx.options.tags);
      const bad = activeId(ctx.store, ctx.arg) ?? noTags(tags) ?? badTagResult('--tags', tags);
      return bad ?? quietly(() => ops.addTags(ctx.fs, ctx.store.paths, ctx.store, ctx.arg, tags));
    },
  },
  {
    name: 'untag',
    arg: 'ID',
    options: ['tags'],
    required: ['tags'],
    help: ['Remove tags from the prompt, case-insensitively. Tags it does', 'not have are ignored.'],
    example: 'prompts --untag=20260921-143005 --tags=urgent',
    store: true,
    run: (ctx) => {
      const tags = parseTags(ctx.options.tags);
      const bad = activeId(ctx.store, ctx.arg) ?? noTags(tags);
      return bad ?? quietly(() => ops.removeTags(ctx.fs, ctx.store.paths, ctx.store, ctx.arg, tags));
    },
  },
  {
    name: 'move',
    arg: 'ID',
    options: ['to'],
    required: ['to'],
    help: ['Move the prompt to position N in the display order, 1 being', 'the top. N past the end means the bottom.'],
    example: 'prompts --move=20260921-143005 --to=1',
    store: true,
    run: (ctx) => {
      const to = ctx.options.to!;
      if (!/^\d+$/.test(to) || Number(to) < 1) return fail(`--to: "${to}": expected a position, 1 or more`);
      return activeId(ctx.store, ctx.arg) ?? quietly(() => ops.moveTo(ctx.fs, ctx.store.paths, ctx.store, ctx.arg, Number(to)));
    },
  },
  {
    name: 'archive',
    arg: 'ID',
    help: ['Move the prompt to the archive now.'],
    example: 'prompts --archive=20260921-143005',
    store: true,
    run: (ctx) => {
      const bad = activeId(ctx.store, ctx.arg);
      if (bad) return bad;
      const r = ops.archive(ctx.fs, ctx.store.paths, ctx.store, [ctx.arg]);
      if (r.error) throw r.error;
      return ok('');
    },
  },
  {
    name: 'restore',
    arg: 'ID',
    help: ['Move an archived prompt back, first in the display order.'],
    example: 'prompts --restore=20260921-143005',
    store: true,
    run: (ctx) => {
      if (!ctx.store.archived.has(ctx.arg)) return fail(`no archived prompt with id "${ctx.arg}"`);
      return quietly(() => ops.restore(ctx.fs, ctx.store.paths, ctx.store, ctx.arg));
    },
  },
  {
    name: 'list-archive',
    options: ['search'],
    help: ['Print one line per archived prompt, newest first, in the', '--list format. --search works as with --list.'],
    example: 'prompts --list-archive --search=release',
    store: true,
    run: ({ store, options }) => ok(lines(archivedIds(store.archived, '').map((id) => store.archived.get(id)!), options.search)),
  },
  {
    name: 'settings',
    help: ['Print the settings as KEY: VALUE lines. Unset keys are omitted.', `Keys: ${SETTING_KEYS.join(', ')}.`],
    example: 'prompts --settings',
    store: true,
    run: ({ store }) => ok(serializeSettings({ ...store.settings })),
  },
  {
    name: 'set',
    arg: 'KEY=VALUE',
    help: ['Change a setting. An empty VALUE removes it.'],
    example: 'prompts --set="editor=code --wait"',
    store: true,
    run: (ctx) => {
      const at = ctx.arg.indexOf('=');
      if (at < 0) return fail(`--set: "${ctx.arg}": expected KEY=VALUE`);
      const key = ctx.arg.slice(0, at).trim();
      if (!(SETTING_KEYS as readonly string[]).includes(key)) return fail(`--set: unknown setting "${key}"`);
      saveSettings(ctx.fs, ctx.store.paths, { ...ctx.store.settings, [key as SettingKey]: ctx.arg.slice(at + 1).trim() });
      return ok('');
    },
  },
  {
    name: 'init',
    help: ['Create .prompts in the directory. Fails if it already exists.'],
    example: 'prompts ~/work/project --init',
    store: false,
    run: ({ fs, dir }) => {
      if (!fs.isDir(dir)) return fail(`${dir}: not a directory`);
      const paths = pathsFor(dir);
      if (fs.exists(paths.root)) return fail(`${paths.root}: already exists`);
      initStore(fs, paths);
      return ok('');
    },
  },
  {
    name: 'upgrade',
    help: ['Upgrade .prompts to the current format. Does nothing when it is', 'already current.'],
    example: 'prompts --upgrade',
    store: false,
    run: ({ fs, dir }) => {
      const opened = openStore(fs, dir);
      if ('outdated' in opened) {
        const r = upgradeStore(fs, opened.paths);
        return r.ok ? ok('') : fail(...r.errors);
      }
      return opened.ok ? ok('') : notOpened(opened, dir);
    },
  },
  {
    name: 'help',
    help: ['Print this help.'],
    example: 'prompts --help',
    store: false,
    run: () => ok(HELP),
  },
];

const byName = new Map(COMMANDS.map((c) => [c.name, c]));

const usage = (c: CommandDef) =>
  [
    c.arg ? `--${c.name}=${c.arg}` : `--${c.name}`,
    ...(c.options ?? []).map((o) => {
      const flag = `--${o}=${OPTIONS[o]}`;
      return c.required?.includes(o) ? flag : `[${flag}]`;
    }),
  ].join(' ') + (c.stdin ? '  < content' : '');

export const HELP = `Usage:
  prompts [dir]                      interactive app
${COMMANDS.map((c) => `  prompts [dir] ${usage(c)}`).join('\n')}

Manages prompt drafts stored in <dir>/.prompts (dir defaults to the current
directory). The flags below never prompt and need no terminal. Only --init
creates .prompts.

Commands:
${COMMANDS.map((c) => `  ${usage(c)}\n${c.help.map((l) => `      ${l}`).join('\n')}`).join('\n')}

TAGS is a comma-separated list. A tag contains only letters, numbers,
dashes and underscores. Values may be given as --flag=value or --flag value.

SEARCH: QUERY is split on spaces into terms; text in double quotes is one
term, spaces included. A prompt matches when every term appears in its
title, its text or one of its tags, ignoring case.

Exit status: 0 success, 1 error (bad input, unknown ID, invalid, missing or
outdated .prompts), 2 usage error. Errors go to stderr.

Examples:
${COMMANDS.map((c) => `  ${c.example}`).join('\n')}
`;

export function parseArgs(argv: string[]): ParsedArgs {
  let parsed;
  try {
    parsed = nodeParseArgs({
      args: argv,
      allowPositionals: true,
      options: Object.fromEntries([
        ...COMMANDS.map((c) => [c.name, { type: c.arg ? 'string' : 'boolean' }] as const),
        ...Object.keys(OPTIONS).map((o) => [o, { type: 'string' }] as const),
      ]),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  const values = parsed.values as Record<string, string | boolean | undefined>;
  const { positionals } = parsed;
  const dir = positionals[0];
  if (values.help) return { dir, command: { name: 'help', arg: '', options: {} } };
  if (positionals.length > 1) return { error: `unexpected argument "${positionals[1]}"` };

  const given = COMMANDS.filter((c) => values[c.name] !== undefined);
  if (given.length > 1) return { error: `use only one of ${given.map((c) => `--${c.name}`).join(', ')}` };
  const def = given[0];
  const options: Command['options'] = {};
  for (const o of Object.keys(OPTIONS) as OptionName[]) {
    const v = values[o];
    if (v === undefined) continue;
    if (!def?.options?.includes(o)) {
      const users = COMMANDS.filter((c) => c.options?.includes(o)).map((c) => `--${c.name}`);
      return { error: `--${o} requires ${users.join(' or ')}` };
    }
    options[o] = v as string;
  }
  if (!def) return { dir, command: null };
  const missing = def.required?.find((o) => options[o] === undefined);
  if (missing) return { error: `--${def.name} requires --${missing}` };
  const arg = values[def.name];
  return { dir, command: { name: def.name, arg: typeof arg === 'string' ? arg : '', options } };
}

/** Run `command` against the store in `dir`. `readStdin` is called only by commands that take content. */
export async function runCommand(
  fs: Fs,
  dir: string,
  command: Command,
  readStdin: () => Promise<string>,
  now: Date = new Date(),
): Promise<CommandResult> {
  const def = byName.get(command.name)!;
  const ctx: Context = { fs, dir, arg: command.arg, options: command.options, readStdin, now };
  if (!def.store) return def.run(ctx);
  const opened = openStore(fs, dir);
  if (!opened.ok) return notOpened(opened, dir);
  try {
    return await def.run({ ...ctx, store: opened.store });
  } catch (e) {
    return fail((e as Error).message);
  }
}

function notOpened(opened: Exclude<ReturnType<typeof openStore>, { ok: true }>, dir: string): CommandResult {
  if ('errors' in opened) return fail(...opened.errors);
  if ('outdated' in opened) {
    return fail(`${dir}: .prompts is in an older format; run prompts --upgrade, or prompts in a terminal, to upgrade it`);
  }
  return fail(`${dir}: no .prompts directory; run prompts --init, or prompts in a terminal, to set one up`);
}

function lines(prompts: Prompt[], search = ''): string {
  return prompts
    .filter((p) => matchesSearch(p, search))
    .map((p) => `${p.id}\t${p.title}\t${p.tags.join(',')}\n`)
    .join('');
}

/** null when `id` is an active prompt, else the error to return. */
function activeId(store: Store, id: string): CommandResult | null {
  if (store.prompts.has(id)) return null;
  if (store.archived.has(id)) return fail(`prompt "${id}" is archived; restore it first`);
  return unknownId(id);
}

function badTag(flag: string, tags: readonly string[]): string | null {
  for (const t of tags) {
    const problem = validateTag(t);
    if (problem) return `${flag}: "${t}": ${problem}`;
  }
  return null;
}

function badTagResult(flag: string, tags: readonly string[]): CommandResult | null {
  const bad = badTag(flag, tags);
  return bad ? fail(bad) : null;
}

const noTags = (tags: readonly string[]) => (tags.length === 0 ? fail('--tags: no tags given') : null);
const ok = (stdout: string): CommandResult => ({ code: 0, stdout, stderr: '' });
/** Run an operation whose result the CLI does not print; succeed with no output. */
const quietly = (operation: () => unknown): CommandResult => {
  operation();
  return ok('');
};
const fail = (...lines: string[]): CommandResult => ({ code: 1, stdout: '', stderr: lines.map((l) => `${l}\n`).join('') });
const unknownId = (id: string) => fail(`no prompt with id "${id}"`);
