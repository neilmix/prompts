# prompts

Terminal app (Node, TypeScript, Ink) that manages AI prompt drafts in a
`.prompts` directory. Published on npm as `@neilmix/prompts`, bin `prompts`.

## Read first

- `docs/spec.md`: authoritative behavior. Every feature and key binding.
- `docs/file-format.md`: on-disk format and validation rules.
- `docs/architecture.md`: module layout, state model, testing approach.
- `docs/development.md`: scripts and release steps.

## Rules

- The spec is the source of truth. If code and spec disagree, the spec wins
  unless the user says otherwise. Change spec and code together.
- TDD. Store and model logic get unit tests; UI gets
  `ink-testing-library` tests; startup gets integration tests in `./tmp`.
- Keep `src/store` and `src/model` free of Ink imports.
- New tags match `[A-Za-z0-9_-]+` (enforced on input, not on load). Tag
  comparison is case-insensitive. Titles never contain tabs, because
  `--list` output is tab-separated.
- Archive marks are in memory only. In the app, marked prompts move to `archive/`
  only on Quit. No prompt is ever deleted.
- Every file written to `.prompts` uses the `key: value` syntax from
  file-format.md and ends with a newline. Exceptions: `README.md`
  (Markdown), `VERSION` (a bare number), and the text part of an item file,
  stored exactly as given.
- A change to the on-disk layout bumps `STORE_VERSION` and adds an upgrade
  step (`src/store/upgrade.ts`, file-format.md).
- Store changes go through `src/ops.ts`; every app capability that makes
  sense without a terminal gets a `command.ts` table entry.
- Do not add settings, keys, or commands beyond the spec without asking.
- Update `CHANGELOG.md` under Unreleased for user-visible changes.
- Import sibling `.tsx` modules with a `.js` extension. A `.jsx` extension
  is copied into `dist/` unchanged and fails at runtime.
