import { parseArgs as nodeParseArgs } from 'node:util';
import { allTags, canonicalTag, fullOrder, matchesFilter, tagEq, validateTag } from './model/select.js';
import type { Fs } from './store/fs.js';
import { openStore, type Store } from './store/open.js';
import { cleanTitle, createPrompt, parseTags, readText, writeText } from './store/prompts.js';
import { saveSort } from './store/sort.js';

/** A non-interactive command given by flags. */
export type Command =
  | { kind: 'help' }
  | { kind: 'list'; filter: string[] }
  | { kind: 'show'; id: string }
  | { kind: 'write'; id: string }
  | { kind: 'create'; title: string; tags: string[] };

/** `command` is null when no flags were given: run the interactive app. */
export type ParsedArgs = { dir: string | undefined; command: Command | null } | { error: string };

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export const HELP = `Usage:
  prompts [dir]                      interactive app
  prompts [dir] --list [--filter=TAGS]
  prompts [dir] --show=ID
  prompts [dir] --write=ID           < content
  prompts [dir] --create --title=TITLE [--tags=TAGS]  < content
  prompts --help

Manages prompt drafts stored in <dir>/.prompts (dir defaults to the current
directory). The flags below never prompt and never create .prompts; run the
interactive app once in a terminal to set it up.

Commands:
  --list            Print one line per prompt, in display order:
                      ID<TAB>TITLE<TAB>TAGS
                    TAGS is comma-separated with no spaces, empty when none.
  --filter=TAGS     With --list: only prompts having every listed tag.
                    Tags match case-insensitively.
  --show=ID         Print the prompt's text exactly as stored.
  --write=ID        Replace the prompt's text with stdin, exactly as given.
  --create          Create a prompt whose text is stdin and print its ID.
                    It goes first in the display order.
  --title=TITLE     Required with --create. Tabs become spaces.
  --tags=TAGS       Optional with --create. An existing tag that matches
                    case-insensitively keeps its existing spelling.
  --help            Print this help.

TAGS is a comma-separated list. A tag contains only letters, numbers,
dashes and underscores. Values may be given as --flag=value or --flag value.

Exit status: 0 success, 1 error (bad input, unknown ID, invalid or missing
.prompts), 2 usage error. Errors go to stderr.

Examples:
  prompts --list --filter=work,urgent
  prompts --show=20260921-143005
  echo "New text" | prompts --write=20260921-143005
  id=$(printf 'Summarize this.' | prompts --create --title="Summarizer" --tags=work)
`;

/** Commands other than --help, which wins over everything. */
const COMMANDS = ['list', 'show', 'write', 'create'] as const;

export function parseArgs(argv: string[]): ParsedArgs {
  let parsed;
  try {
    parsed = nodeParseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        help: { type: 'boolean' },
        list: { type: 'boolean' },
        show: { type: 'string' },
        write: { type: 'string' },
        create: { type: 'boolean' },
        filter: { type: 'string' },
        title: { type: 'string' },
        tags: { type: 'string' },
      },
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { values: v, positionals } = parsed;
  const dir = positionals[0];
  if (v.help) return { dir, command: { kind: 'help' } };
  if (positionals.length > 1) return { error: `unexpected argument "${positionals[1]}"` };

  const given = COMMANDS.filter((c) => v[c] !== undefined);
  if (given.length > 1) return { error: `use only one of ${given.map((c) => `--${c}`).join(', ')}` };
  const kind: (typeof COMMANDS)[number] | undefined = given[0];
  const onlyWith = (flag: 'filter' | 'title' | 'tags', cmd: string) =>
    v[flag] !== undefined && kind !== cmd ? `--${flag} requires --${cmd}` : null;
  const misplaced = onlyWith('filter', 'list') ?? onlyWith('title', 'create') ?? onlyWith('tags', 'create');
  if (misplaced) return { error: misplaced };

  switch (kind) {
    case undefined:
      return { dir, command: null };
    case 'list':
      return { dir, command: { kind, filter: parseTags(v.filter) } };
    case 'show':
    case 'write':
      return { dir, command: { kind, id: v[kind]! } };
    case 'create':
      if (v.title === undefined) return { error: '--create requires --title' };
      return { dir, command: { kind, title: v.title, tags: parseTags(v.tags) } };
  }
}

/** Run `command` against the store in `dir`. `readStdin` is called only by commands that take content. */
export async function runCommand(
  fs: Fs,
  dir: string,
  command: Command,
  readStdin: () => Promise<string>,
  now: Date = new Date(),
): Promise<CommandResult> {
  if (command.kind === 'help') return { code: 0, stdout: HELP, stderr: '' };
  const opened = openStore(fs, dir);
  if (!opened.ok) {
    if ('errors' in opened) return fail(...opened.errors);
    return fail(`${dir}: no .prompts directory; run prompts in a terminal to set one up`);
  }
  const store = opened.store;
  switch (command.kind) {
    case 'list': {
      const bad = badTag('--filter', command.filter);
      if (bad) return fail(bad);
      const lines = fullOrder(store)
        .map((id) => store.prompts.get(id)!)
        .filter((p) => matchesFilter(p, command.filter))
        .map((p) => `${p.id}\t${p.title}\t${p.tags.join(',')}\n`);
      return ok(lines.join(''));
    }
    case 'show':
      if (!store.prompts.has(command.id)) return unknownId(command.id);
      return ok(readText(fs, store.paths, command.id));
    case 'write':
      if (!store.prompts.has(command.id)) return unknownId(command.id);
      writeText(fs, store.paths, command.id, await readStdin());
      return ok('');
    case 'create':
      return create(fs, store, command, readStdin, now);
  }
}

async function create(
  fs: Fs,
  store: Store,
  command: Extract<Command, { kind: 'create' }>,
  readStdin: () => Promise<string>,
  now: Date,
): Promise<CommandResult> {
  if (/[\r\n]/.test(command.title)) return fail('--title: titles may not contain line breaks');
  if (cleanTitle(command.title) === '') return fail('--title: title is empty');
  const bad = badTag('--tags', command.tags);
  if (bad) return fail(bad);
  const existing = allTags(store.prompts.values());
  const tags: string[] = [];
  for (const t of command.tags) {
    const tag = canonicalTag(t, existing);
    if (!tags.some((x) => tagEq(x, tag))) tags.push(tag);
  }
  const text = await readStdin();
  const prompt = createPrompt(fs, store.paths, command.title, new Set(store.prompts.keys()), now, tags, text);
  saveSort(fs, store.paths, [prompt.id, ...fullOrder(store)]);
  return ok(`${prompt.id}\n`);
}

function badTag(flag: string, tags: readonly string[]): string | null {
  for (const t of tags) {
    const problem = validateTag(t);
    if (problem) return `${flag}: "${t}": ${problem}`;
  }
  return null;
}

const ok = (stdout: string): CommandResult => ({ code: 0, stdout, stderr: '' });
const fail = (...lines: string[]): CommandResult => ({ code: 1, stdout: '', stderr: lines.map((l) => `${l}\n`).join('') });
const unknownId = (id: string) => fail(`no prompt with id "${id}"`);
