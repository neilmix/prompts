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

State lives in a `.prompts` folder in the target directory. When there is
none, `prompts` asks whether to create it.

Everything lives in `.prompts` as plain text, so commit it alongside your
project. See [docs/file-format.md](docs/file-format.md).

## Screen layout

```
┌ list pane ─────────────────────────────┐
│ ▸ Refactor the auth middleware         │
│   Write release notes for 2.3          │
│                                        │
├ tag pane ──────────────────────────────┤
│ [backend] [auth]                       │
├ command pane ──────────────────────────┤
│ New  Open  Copy  Done  Tag  Filter  Settings  Reload  Quit
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
| letter | Activate the button whose underlined letter it is |
| Escape | Close the current modal |

## Commands

| Command | Key | What it does |
| --- | --- | --- |
| New | n | Create a prompt from a title and open it in your editor |
| Open | o | Read the prompt. From there: Edit, change the Title, Copy to clipboard, mark Done, or go Back |
| Copy | c | Copy the prompt text to the clipboard, or the title when the text is blank |
| Done | d | Toggle the prompt as done. Done prompts are deleted on Quit |
| Tag | t | Add or remove tags on the prompt |
| Filter | f | Show only prompts that have every selected tag |
| Settings | s | Change the editor command |
| Reload | r | Reread `.prompts` from disk |
| Quit | q, Ctrl+C | Exit, deleting done prompts after confirmation |

## Editor

Editing uses, in order: the `editor` setting in `.prompts/settings.txt`,
then `$EDITOR`, then `vi`. The value is a shell command, so
`code --wait` or `emacsclient -nw` work.

## Documentation

- [docs/spec.md](docs/spec.md): full behavior specification
- [docs/file-format.md](docs/file-format.md): the `.prompts` directory
- [docs/architecture.md](docs/architecture.md): how the code is organized
- [docs/development.md](docs/development.md): building, testing, releasing

## License

MIT. See [LICENSE](LICENSE).
