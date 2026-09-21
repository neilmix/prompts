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
  cli.ts              entry point: argv, startup checks, render <App/>
  store/
    format.ts         parse/serialize the `key: value` settings syntax
    ids.ts            ID generation and validation
    prompts.ts        load/save index and text files, delete
    sort.ts           sort.txt read/write, display order, move up/down
    settings.ts       settings.txt read/write, editor resolution
    validate.ts       startup validation, error messages
    fs.ts             filesystem adapter (real and in-memory for tests)
  model/
    types.ts          Prompt, Settings, Store, Filter
    state.ts          app state reducer: selection, filter, completed set,
                      modal stack
    select.ts         derived data: visible prompts, all tags, tag matching
  ui/
    App.tsx           root: state, key routing, pane composition
    panes/
      ListPane.tsx
      TagPane.tsx
      CommandPane.tsx
      TitleBar.tsx
    modals/
      NewModal.tsx
      OpenModal.tsx
      TagModal.tsx
      FilterModal.tsx
      SettingsModal.tsx
    controls/
      TextInput.tsx   shared single-line input with optional autocomplete
      ScrollList.tsx  scrollable, selectable, wrapping list
      Checklist.tsx   multi-select list for Filter
    hooks/
      useKeys.ts      normalizes Ink key events into named actions
      useSize.ts      terminal dimensions
  editor.ts           spawn external editor with Ink paused
```

Tests sit next to the code as `*.test.ts` / `*.test.tsx`.

## State

A single reducer in `model/state.ts` owns:

- `prompts`: map of ID to Prompt, plus `order` from sort.txt
- `settings`
- `selectedId`, `selectedButton`
- `filter`: set of checked tags
- `completed`: set of IDs
- `modal`: `null | { kind, ...local state }`
- `error`: transient message for the command pane

Side effects (writes, spawning the editor) happen in `App.tsx` handlers that
call the store, then dispatch the resulting change. The reducer never
touches the filesystem.

## Key handling

Ink's `useInput` delivers `(input, key)`. `useKeys` maps that to one of a
fixed set of action names (`up`, `pageDown`, `top`, `moveUp`, `activate`,
`shortcut:n`, ...) so components never inspect raw key flags. Terminal
support for Ctrl+Shift+arrows varies; Home and End are the reliable
alternates and map to the same actions.

Exactly one component consumes keys at a time: the topmost modal, or the
list view. Inside a modal, a focused text input consumes keys before the
modal's buttons.

## Editor

`editor.ts` calls Ink's `instance.clear()`, then `spawnSync` with
`stdio: 'inherit'`, then re-renders. Ink is not unmounted; stdin raw mode
is released for the duration via `setRawMode(false)`.

## Testing

- Store and model: plain vitest unit tests against the in-memory fs adapter.
- UI: `ink-testing-library` renders components, feeds key sequences with
  `stdin.write`, and asserts on `lastFrame()`. Escape sequences for special
  keys are defined once in a test helper.
- Startup: integration tests run `cli.ts` against temp directories in
  `./tmp` and assert exit codes and stderr.
