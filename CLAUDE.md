# prompts

Terminal app (Node, TypeScript, Ink) that manages AI prompt drafts in a
`.prompts` directory. Published on npm as `prompts`.

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
- Tags never contain commas. Tag comparison is case-insensitive.
- Completed state is in memory only. Deletion happens only on Leave.
- Every file written to `.prompts` uses the `key: value` syntax from
  file-format.md and ends with a newline.
- Do not add settings, keys, or commands beyond the spec without asking.
- Update `CHANGELOG.md` under Unreleased for user-visible changes.
