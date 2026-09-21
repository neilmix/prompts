# prompts

AI prompt management for solo developers.

`prompts` is a terminal app that keeps a directory of prompt drafts under
version control. Toss raw ideas in, tag and reorder them, edit them over
time, and hand them to an AI assistant when they are ready.

## Install

```sh
npm install -g prompts
```

## Run

```sh
prompts            # use the current directory
prompts ~/work/x   # use another directory
```

The target directory must contain a `.prompts` folder. An empty directory
gets one created automatically. A non-empty directory without `.prompts`
exits with `Not a prompts directory`.

Everything lives in `.prompts` as plain text, so commit it alongside your
project. See [docs/file-format.md](docs/file-format.md).

## Screen layout

```
┌ list pane ─────────────────────────────┐
│ > Refactor the auth middleware         │
│                                        │
│   Write release notes for 2.3          │
│                                        │
├ tag pane ──────────────────────────────┤
│ backend  auth                          │
├ command pane ──────────────────────────┤
│ [New] Open Complete Tag Filter Settings Leave
└────────────────────────────────────────┘
```

## Keys

| Key | Action |
| --- | --- |
| Up / Down | Select previous / next prompt |
| Ctrl+Up / Ctrl+Down | Scroll a page |
| Ctrl+Shift+Up / Home | Jump to top |
| Ctrl+Shift+Down / End | Jump to bottom |
| Shift+Up / Shift+Down | Move the selected prompt up / down in the sort order |
| Tab | Select the next command button |
| Enter | Activate the selected button |
| Ctrl+letter | Activate the button starting with that letter |
| Escape | Close the current modal |

## Commands

| Command | Shortcut | What it does |
| --- | --- | --- |
| New | Ctrl+N | Create a prompt from a title |
| Open | Ctrl+O | Read the prompt. From there: Edit in your editor, change the Title, or go Back |
| Complete | Ctrl+C | Toggle the prompt as complete. Completed prompts are deleted on Leave |
| Tag | Ctrl+T | Add or remove tags on the prompt |
| Filter | Ctrl+F | Show only prompts that have every selected tag |
| Settings | Ctrl+S | Change the editor command |
| Leave | Ctrl+L | Exit, deleting completed prompts |

## Editor

Editing uses, in order: the `editor` setting in `.prompts/settings.txt`,
then `$EDITOR`, then `vi`.

## Documentation

- [docs/spec.md](docs/spec.md): full behavior specification
- [docs/file-format.md](docs/file-format.md): the `.prompts` directory
- [docs/architecture.md](docs/architecture.md): how the code is organized
- [docs/development.md](docs/development.md): building, testing, releasing

## License

MIT. See [LICENSE](LICENSE).
