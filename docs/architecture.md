# Architecture

Node + TypeScript, ESM, rendered with [Ink](https://github.com/vadimdemedes/ink).
Published on npm as `prompts` with a single `bin` entry.

## Principles

- The store layer is pure functions over strings and a thin filesystem
  adapter. It has no Ink imports. All parsing, serialization, sorting,
  filtering, and ID logic lives here and is unit tested directly.
- UI components hold no business rules. They dispatch actions and render
  state.
- One in-memory model of the whole store is loaded at startup. Writes go
  through the store layer and update the model; nothing re-reads from disk
  except after the external editor returns.

## Layout

```
src/
  cli.tsx             entry point: argv, store open, terminal check,
                      first-run Setup question, mouse mode, exit summary
  store/
    format.ts         parse/serialize the `key: value` settings syntax
    ids.ts            ID generation and validation
    prompts.ts        load/save index and text files, delete
    sort.ts           sort.txt read/write, display order, move up/down
    settings.ts       settings.txt read/write, editor resolution
    validate.ts       startup validation, error messages
    fs.ts             filesystem adapter (real and in-memory for tests)
  model/
    types.ts          Prompt, State, Modal, Message
    state.ts          app state reducer: selection, filter, search, done set,
                      modal, message; replaceStore for Reload
    select.ts         derived data: visible prompts, tag counts, tag matching
  ui/
    App.tsx           root: reducer, side-effecting actions, ^C, quit
                      confirmation overlay, minimum size guard, view switch
    ListView.tsx      the main view
    Setup.tsx         "Configure now? (y/n)" shown when .prompts is missing
    context.ts        Actions and ViewProps shared by views
    keys.ts           toAction: Ink (input, key) → named action, incl. mouse;
                      vimAction: j/k/g/G mapping
    text.ts           wrapText, listViewport (scroll to keep selection),
                      rows with a styled tail (tag chips), chips, rangeLabel
    panes/
      TitleBar.tsx    inverse bar: `View › Title` left, detail right
      CommandPane.tsx separator, message line, underlined-shortcut buttons
      Separator.tsx   `─` rule with optional label, centered text and counter
    modals/
      NewModal.tsx    title entry, then editor
      OpenModal.tsx   text pane, Edit/Retitle/Tag/Copy/Done/Back
      TagModal.tsx    tag list; `from` says which view Back returns to
      FilterModal.tsx
      SettingsModal.tsx
    controls/
      ListBody.tsx    renders viewport rows with gutter and focus styling
      TextInput.tsx   single-line entry with completion hint
      Confirm.tsx     y/n question in the input pane
    hooks/
      useCommands.ts  focus model: body + buttons; Left/Right/Tab/Enter/letter
      useKeyActions.ts useInput wrapper feeding toAction
      useSize.ts      terminal dimensions (overridable for tests)
  editor.ts           runs the editor shell command via `sh -c`
  clipboard.ts        pbcopy / wl-copy / xclip / xsel
```

Tests sit next to the code as `*.test.ts` / `*.test.tsx`.

## Startup

`openStore` never creates files. It returns the loaded store, a list of
validation errors, or `missing` when `.prompts` is absent. The CLI handles
`missing` by rendering `Setup` in the normal screen and, on `y`, calling
`initStore` then `loadStore`. Errors are reported before the terminal check
so they work in pipes and tests.

## State

A single reducer in `model/state.ts` owns:

- `prompts`: map of ID to Prompt, plus `sort` from sort.txt
- `settings`
- `selectedId`
- `filter`: checked tags; `search`: title substring
- `done`: set of IDs
- `modal`: `null | { kind, id? }`. There is no modal stack: one modal is
  shown at a time, and a view that can be reached from two places (Tag,
  from list or Open) carries a `from` field and reopens the parent on Back.
- `message`: transient error or status for the command pane

Per-view state (focus, scroll top, open entries, the list view's move
mode) lives in the view component and resets when the view mounts.

Side effects (writes, spawning the editor) happen in `App.tsx` handlers that
call the store, then dispatch the resulting change. The reducer never
touches the filesystem.

## Key handling

Ink's `useInput` delivers `(input, key)`. `toAction` in `ui/keys.ts` maps
that to one named action (`up`, `pageDown`, `space`, `char`, `mouse`, ...)
so components never inspect raw key flags. Modifiers on arrow keys are
dropped on purpose: terminals disagree on sending them (Terminal.app sends
none by default), so every binding uses a plain key. Reordering is a mode
(Space) in `ListView` rather than a chord.

Each view calls `useCommands` for the focus model and `useKeyActions` for
its body keys. A view's handler is inactive while one of its text entries
or the App-level quit confirmation is mounted; those components subscribe
themselves. `App` keeps one extra `useInput` for ^C and message clearing.

Mouse: the CLI enables SGR mouse reporting (`?1000h ?1006h`). Reports
arrive through `useInput` as text like `[<0;12;5M`, which `toAction`
decodes into 0-based coordinates. Views hit-test against their own layout.
Mouse reporting is turned off around the editor and on exit.

## Editor

`App.edit` wraps `runEditor` in Ink's `suspendTerminal`, which releases
raw mode and the alternate screen, then redraws. `runEditor` spawns
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
- Startup: integration tests run `cli.ts` against temp directories in
  `./tmp` and assert exit codes and stderr.
