# Architecture

Node + TypeScript, ESM, rendered with [Ink](https://github.com/vadimdemedes/ink).
Published on npm as `prompts` with a single `bin` entry.

## Principles

- The store layer is pure functions over strings and a thin filesystem
  adapter. It has no Ink imports. All parsing, serialization, sorting,
  and ID logic lives here and is unit tested directly.
- Every change to the store goes through `ops.ts`, shared by the app and
  the command-line flags, so a capability is written once.
- UI components hold no business rules. They dispatch actions and render
  state.
- One in-memory model of the whole store, prompt text and archive
  included, is loaded at startup. Writes go through `ops.ts` and update the
  model. Changing a prompt rereads its file first, so a title change keeps
  text another process wrote since loading, and the reverse.

## Layout

```
src/
  cli.tsx             entry point: argv, store open, terminal check,
                      Setup / upgrade question, mouse mode, exit summary;
                      hands command flags to command.ts
  command.ts          the command table: one entry per flag command with
                      its options, help text and run function; parseArgs,
                      --help and runCommand are driven by the table
  ops.ts              store operations shared by App and command.ts:
                      create, retitle, tags, text, move, archive, restore
  store/
    format.ts         parse/serialize the `key: value` settings syntax
    ids.ts            ID generation and validation
    open.ts           VERSION, open/load/validate, initStore (Setup)
    upgrade.ts        version 0 → 1 upgrade
    paths.ts          file locations, plus the version 0 ones for upgrade
    prompts.ts        item file parse/serialize, load, save, update,
                      archive/restore file moves
    sort.ts           sort.txt read/write, display order, move up/down
    settings.ts       settings.txt read/write, editor resolution
    fs.ts             filesystem adapter (real and in-memory for tests)
  model/
    types.ts          Prompt, State, Modal, Message
    state.ts          app state reducer: selection, search, archive marks,
                      archived prompts, modal, message; replaceStore for Reload
    select.ts         derived data: search terms and matching, visible and
                      archived ids, taken ids, tag matching
  ui/
    App.tsx           root: reducer, side-effecting actions (via ops.ts),
                      editor temp file, ^C, quit, minimum size guard, view switch
    ListView.tsx      the main view
    Setup.tsx         y/n question before the app: "Configure now?" when
                      .prompts is missing, "Upgrade?" when it is version 0
    context.ts        Actions and ViewProps shared by views
    keys.ts           toAction: Ink (input, key) → named action, incl. wheel;
                      vimAction: j/k/g/G mapping
    text.ts           wrapText, listViewport (scroll to keep selection),
                      rows with a styled tail (tag chips), chips, rangeLabel
    panes/
      TitleBar.tsx    inverse bar: `View › Title` left, detail right
      CommandPane.tsx separator, message line, underlined-shortcut buttons
      Separator.tsx   `─` rule with optional label, centered text and counter
    modals/
      NewModal.tsx    title entry, then editor
      OpenModal.tsx   text pane, Edit/Retitle/Tag/Copy/Archive/Back; with
                      `archived`, the read-only Archived view
      TagModal.tsx    tag list; `from` says which view Back returns to
      ArchiveModal.tsx archived prompts with their own search, Open/Restore
      SettingsModal.tsx
    controls/
      ListBody.tsx    renders viewport rows with gutter and focus styling
      TextInput.tsx   single-line entry with completion hint
    hooks/
      useCommands.ts  focus model: body + buttons; Left/Right/Tab/Enter/letter
      useKeyActions.ts useInput wrapper feeding toAction
      useSize.ts      terminal dimensions (overridable for tests)
  editor.ts           runs the editor shell command via `sh -c`
  clipboard.ts        pbcopy / wl-copy / xclip / xsel
```

Tests sit next to the code as `*.test.ts` / `*.test.tsx`.

## Startup

`openStore` never creates or changes files. It returns the loaded store, a
list of validation errors, `missing` when `.prompts` is absent, or
`outdated` when it has no `VERSION` (version 0). The CLI handles `missing`
and `outdated` by rendering `Setup` with the matching question in the
normal screen and, on `y`, calling `initStore` or `upgradeStore`, then
`loadStore`. Errors are reported before the terminal check
so they work in pipes and tests.

Command flags skip all of that. `command.ts` holds a table with one entry
per command: its flag, the options it accepts and requires, help text, an
example, and a `run` function. `parseArgs` builds the `node:util` parser
from the table and returns the directory and a `Command` (or null for the
interactive app); `HELP` is generated from it too. `runCommand` opens the
store (unless the entry handles the directory itself, as `--init` and
`--upgrade` do), runs the entry, and returns `{ code, stdout, stderr }`
without touching the process, so it is unit tested over `MemoryFs`. Adding
a command means adding an `ops.ts` function, if the app lacks one, and a
table entry.
`cli.tsx` supplies stdin (read asynchronously: `readFileSync(0)` fails with
EAGAIN on non-blocking pipes) and waits for output to flush, ignoring
EPIPE, before exiting.

## State

A single reducer in `model/state.ts` owns:

- `prompts` and `archived`: maps of ID to Prompt (title, tags, text), plus
  `sort` from sort.txt
- `settings`
- `selectedId`
- `search`: the list view's search string (the archive view keeps its own)
- `archiving`: IDs marked for archiving on Quit
- `modal`: `null | { kind, id? }`. There is no modal stack: one modal is
  shown at a time, and a view that can be reached from two places (Tag,
  from list or Open) carries a `from` field and reopens the parent on Back.
- `message`: transient error or status for the command pane

Per-view state (focus, scroll top, open entries, the list view's move
mode) lives in the view component and resets when the view mounts.

Side effects (writes, spawning the editor) happen in `App.tsx` handlers that
call `ops.ts`, then dispatch the resulting change. The reducer never
touches the filesystem.

## Key handling

Ink's `useInput` delivers `(input, key)`. `toAction` in `ui/keys.ts` maps
that to one named action (`up`, `pageDown`, `space`, `char`, `wheel`, ...)
so components never inspect raw key flags. Modifiers on arrow keys are
dropped on purpose: terminals disagree on sending them (Terminal.app sends
none by default), so every binding uses a plain key. Reordering is a mode
(Space) in `ListView` rather than a chord.

Each view calls `useCommands` for the focus model and `useKeyActions` for
its body keys. A view's handler is inactive while one of its text entries
is mounted; the entry subscribes itself. `App` keeps one extra `useInput` for ^C and message clearing.

Mouse: the CLI enables SGR mouse reporting (`?1000h ?1006h`) for the
wheel. Reports arrive through `useInput` as text like `[<64;1;1M`, which
`toAction` turns into a `wheel` action; clicks decode to null on purpose.
Mouse reporting is turned off around the editor and on exit.

## Editor

`App.edit` copies the prompt's text into a temp file (`Fs.mkdtemp`), so
the editor never sees the header, and wraps `runEditor` in Ink's
`suspendTerminal`, which releases raw mode and the alternate screen, then
redraws. Changed text is written back with `updatePrompt`, which keeps the
header as it is on disk; the temp directory is then removed. `runEditor` spawns
`sh -c '<command> "$@"' sh <file>` with inherited stdio. Renders that
happen during the suspension are discarded, so `edit` dispatches a no-op
afterwards to force a redraw.

## Testing

- Store and model: plain vitest unit tests against the in-memory fs adapter.
- UI: `src/test/harness.tsx` renders `App` over a `MemoryFs` with
  `ink-testing-library`, feeds key sequences from `src/test/keys.ts`, and
  tests assert on the stripped frame. `FORCE_COLOR=1` is set in the vitest
  config so focus styling is visible in frames. A bare Escape needs a 40ms
  wait because Ink holds it to see if a sequence follows.
- Startup and flags: integration tests run `cli.tsx` against temp
  directories in `./tmp` and assert exit codes, stdout and stderr.
