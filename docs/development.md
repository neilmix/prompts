# Development

## Setup

```sh
npm install
```

Node 20 or later.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run from source with `tsx` against `./tmp/play` |
| `npm test` | vitest, single run |
| `npm run test:watch` | vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run build` | `tsc` to `dist/` |

## Workflow

- TDD: write the failing test from the relevant section of
  [spec.md](spec.md), then implement.
- Change behavior and its spec in the same commit.
- Scratch files go in `./tmp`, which is gitignored.

## Manual testing

```sh
mkdir -p tmp/play && npm run dev -- tmp/play
```

## Local install

```sh
npm run build
npm link
```

This symlinks `prompts` into the global npm bin (Homebrew's
`/opt/homebrew/bin` when npm came from Homebrew). Rebuild after changes;
the link follows `dist/`. Remove with `npm unlink -g @neilmix/prompts`.

## Release

1. Update `CHANGELOG.md`.
2. `npm version <patch|minor|major>`.
3. `npm publish`. The `prepublishOnly` script runs typecheck, tests, and build.
4. `git push --follow-tags`.

`package.json` points `bin.prompts` at `dist/cli.js` and `files` at `dist`.
