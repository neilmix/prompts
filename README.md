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
none, `prompts` asks whether to create it. A `.prompts` from an older
version of the app is upgraded after asking.

Everything lives in `.prompts` as plain text, so commit it alongside your
project. See [docs/file-format.md](docs/file-format.md).

## Scripts and AI agents

Flags run one command without the UI. Everything the app does, except
running the editor and copying, has a flag. `prompts --help` explains them.

```sh
prompts --list --search=work          # ID<TAB>title<TAB>tags per line
prompts --show=20260921-143005        # print the text
echo "New text" | prompts --write=20260921-143005
printf 'Summarize this.' | prompts --create --title="Summarizer" --tags=work
prompts --tag=20260921-143005 --tags=urgent
prompts --move=20260921-143005 --to=1
prompts --archive=20260921-143005
prompts --init                        # set up .prompts without asking
```

## Screen layout

```
┌ list pane ─────────────────────────────┐
│ ▸ • Refactor the auth middleware [backend] [auth]
│   • Write release notes for 2.3 [docs] │
│                                        │
├ command pane ─── press space to reorder ┤
│ New  Open  Copy  /Search  Archive  Tag  View-archive  Settings  Reload  Quit
└────────────────────────────────────────┘
```

## Keys

| Key | Action |
| --- | --- |
| Up / Down (or k / j) | Select previous / next prompt |
| PageUp / PageDown | Scroll a page |
| Home / End (or g / G) | Jump to top / bottom |
| Space | Enter or leave move mode: the same keys then move the selected prompt in the sort order instead of the selection |
| Tab | Select the next command button |
| Enter | Activate the selected button |
| letter | Activate the button whose underlined letter it is |
| / | Search titles, text and tags; words are ANDed, `"quoted text"` is one term |
| Escape | Close the current modal, leave move mode, or clear the search |

On a Mac keyboard without PageUp, PageDown, Home and End keys, macOS sends
them for Fn+Up, Fn+Down, Fn+Left and Fn+Right.

## Commands

| Command | Key | What it does |
| --- | --- | --- |
| New | n | Create a prompt from a title and open it in your editor |
| Open | o | Read the prompt. From there: Edit, Retitle, Tag, Copy, mark for Archive, or go Back |
| Copy | c | Copy the prompt text to the clipboard, or the title when the text is blank |
| /Search | / | Show only prompts matching the search |
| Archive | a | Mark the prompt for archiving. Marked prompts move to `.prompts/archive` on Quit |
| Tag | t | Add or remove tags on the prompt |
| View-archive | v | Browse archived prompts and Restore them |
| Settings | s | Change the editor command |
| Reload | r | Reread `.prompts` from disk |
| Quit | q, Ctrl+C | Exit, archiving marked prompts |

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
