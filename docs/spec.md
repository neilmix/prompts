# Behavior specification

This document is the source of truth for what `prompts` does. Tests are
derived from it. When behavior changes, change this file in the same commit.

Terms: a **prompt** is one item, made of a title, tags, and a text body.
**Active** prompts live in `items/` and appear in the list view;
**archived** prompts live in `archive/`. The **store** is the `.prompts`
directory (see [file-format.md](file-format.md)). `^X` means Ctrl+X.
Button shortcuts are bare keys (letters, and `/` for Search); Ctrl+letter
does nothing.

## 1. Startup

1. Parse the arguments: at most one positional argument (the target
   directory) plus the flags in section 11. With any command flag, run that
   command instead of the steps below. Resolve the target directory: the
   positional argument, else the current working directory. A missing
   directory is an error.
2. If `<dir>/.prompts` exists, read its version (file-format.md,
   "Versions"). A version newer than 1 is an error. At version 1, load and
   validate it. Errors and validation failures (see file-format.md,
   "Validation") print one line per problem to stderr and exit with status
   1. Nothing is rendered.
3. Stdin and stdout must both be terminals from here on. Otherwise print
   `prompts needs an interactive terminal` to stderr and exit with status 1.
4. If `<dir>/.prompts` does not exist, show the directory and ask
   `This directory is not configured for prompts. Configure now? (y/n)` in
   the normal screen. `y` creates `.prompts/` with `README.md`, `VERSION`,
   `settings.txt`, `sort.txt`, `items/`, and `archive/`, then continues. `n`, Escape, or ^C
   exits with status 0 and creates nothing.
5. If `<dir>/.prompts` is version 0, show the directory and ask
   `Upgrade .prompts to version 1? (y/n)`. `y` upgrades it (file-format.md,
   "Upgrading from version 0"), then loads and validates it as in step 2.
   `n`, Escape, or ^C exits with status 0 and changes nothing. If the
   upgrade finds invalid version 0 files, it changes nothing and reports
   them as in step 2.
6. The app runs in the terminal's alternate screen.
7. If the terminal is smaller than 40 columns by 10 rows, the whole screen
   shows `terminal too small` and only ^C and q work.

## 2. Screen layout

Every view is a stack of panes filling the terminal:

- **Title bar** (modals only): one inverse line. Left: `View › Title`.
  Right: a dim detail such as the prompt ID.
- **Body**: a list or a text pane. Scrolls when it overflows.
- **Input pane** (when a text entry is active): one separator, then
  `Label: value`.
- **Command pane**: a separator, an optional message line, then the buttons.

Separators are full-width `─` lines. A separator may carry a dim label on
its left, e.g. `─ tags ────`, a dim counter on its right, e.g.
`── 3–9 of 42 ─` when the body above it overflows, or dim text centered in
the line, e.g. `──── press space to reorder ────`. Centered text is omitted
when it does not fit.

Empty bodies show a gray hint with the next action: `no prompts · n to
create one`, `no tags · a to add one`, `empty · e to edit`.

## 3. Focus

Each view has focus targets in order: the **body**, then each command
button left to right. Exactly one target has focus. The body has focus when
a view opens.

- Left / Right: move focus to the previous / next target. Stops at the ends.
- Tab: next target, wrapping from the last button to the body.
- Enter: with a button focused, activates it. With the body focused,
  performs the view's primary action (section 5).
- Up / Down and the other body keys (section 4) act on the body no matter
  which target has focus.
- Shortcut letters work no matter which target has focus. They are bare
  lowercase keys; `G` is not a shortcut for `g`, and Ctrl+letter is not a
  shortcut.
- While a text entry is active, it takes every key (section 7).

Display: the focused button is inverse. When the body has focus no button
is inverse, and the selected body row is drawn white on a blue background.
When a button has focus the selected body row is drawn bold with no
background. The selected row always carries a `▸` in the two-column gutter.

## 4. Body keys

Available in every view whose body is a list or a text pane, unless a text
entry is active.

| Key | Action |
| --- | --- |
| Up, k | Previous row, or scroll text up one line |
| Down, j | Next row, or scroll text down one line |
| PageUp | Up one page (the body height in rows) |
| PageDown | Down one page |
| Home, g | First row / top |
| End, G | Last row / bottom |
| Space | List view only: enter or leave move mode (below) |
| q | List view: Quit (also its button shortcut). Modals: Back |
| Escape | List view: clear the search. Modals: Back |

Modifier keys on arrows (Ctrl, Shift, Option) are ignored: terminals differ
on whether they send them, and Terminal.app on macOS sends none by default.
On a Mac keyboard without a navigation cluster, macOS itself maps Fn+Up,
Fn+Down, Fn+Left and Fn+Right to PageUp, PageDown, Home and End.

Rows stay visible: the body scrolls the minimum needed to show the whole
selected row.

**Move mode** (list view): Space with a prompt selected enters move mode.
The selected row's gutter marker becomes `↕` and the row is drawn white on
a magenta background. While in move mode the body keys move the selected
prompt in the sort order (section 6) instead of moving the selection: Up
and Down by one, PageUp and PageDown by a page, Home and End to the first
and last displayed position, and the vim keys likewise. Each move writes
`sort.txt`. Space or Escape leaves move mode; the prompt stays selected.
Every other key, including shortcut letters, Enter, Tab and Left/Right, is
ignored in move mode. ^C still quits.

The list view's command pane separator carries a centered hint whenever a
prompt is selected: `press space to reorder`, or `moving · press space when
done` in move mode. Other views have no hint.

Mouse, when the terminal reports it: wheel up / down moves the selection
(or scrolls text) one row. Clicks are ignored.

## 5. Views

### List view

- Body: prompt titles, single-spaced, one row per prompt, each drawn as
  `• <title> [tag] [tag]` after the gutter, the tag chips in cyan. A
  wrapped row continues on following lines indented two spaces so the text
  lines up under the first line's text; chips wrap with the title.
  Prompts marked for archiving are prefixed `✓ ` (`• ✓ <title>`).
- The first body line, when a search is active, is a yellow header:
  `Search: foo · 2 of 7`.
- The command pane separator carries the range counter on its right when
  the list overflows, e.g. `── press space to reorder ── 3–9 of 42 ─`.
- Buttons: **New, Open, Copy, /Search, Archive, Tag, View-archive,
  Settings, Reload, Quit**. Each button's shortcut is underlined: n, o, c,
  /, a, t, v, s, r, q.
- Primary action (Enter on body): Open.

**New (n)**: title bar `New prompt`, a `Title` entry. Enter with a
non-empty (trimmed) title, tabs replaced by spaces, creates the prompt with
a new ID (one not used by an active or archived prompt) and empty text,
places it first in the sort order, selects it, then immediately runs the
editor on it (as Edit does). On return, the list view is shown. Enter with
an empty title does nothing. Escape cancels.

**Open (o)**: see the Open view.

**Copy (c)**: as Copy in the Open view, for the selected prompt.

**Archive (a)**: toggles the selected prompt's archive mark, in memory
only. The button reads `Archive`, or `✓ Archive` when the selected prompt
is marked. Nothing moves until Quit.

**Tag (t)**, **View-archive (v)**, **Settings (s)**: see those views.

**Reload (r)**: rereads `.prompts` from disk. Selection, search and
archive marks are kept where the IDs still exist. If the reread fails
validation, the current state is kept and the first problem is shown as an
error message.

**Quit (q, also ^C in every view)**: moves each marked prompt's file to
`archive/` and drops it from `sort.txt`, without asking, then exits. After
the alternate screen closes, the app prints `Archived N prompt(s).` to
stdout when N > 0. Exit status is 0. If a move fails, the app stays open
and shows the error; prompts already moved are gone from the list.

**Search (/)**: a `Search` entry in the input pane, pre-filled with the
current search. The list filters live as the user types. The search is
split on spaces into terms; text in double quotes is one term, spaces
included (an unclosed quote runs to the end). A prompt matches when every
term appears, case-insensitively, in its title, its text, or one of its
tags. Enter keeps the search and closes the entry. Escape clears the search
and closes the entry. Search is not persisted.

### Open view

- Title bar: `Open › <title>` followed by the tag chips `[work] [urgent]`,
  right: the prompt ID.
- Body: the prompt's text, scrollable. A single trailing newline is not
  shown as a blank line. Empty text shows the empty hint.
- The separator below the body is labeled with the item file's relative
  path, e.g. `─ .prompts/items/20260921-143005.md ─`, with the range
  counter on its right when the text overflows.
- Buttons: **Edit, Retitle, Tag, Copy, Archive, Back**. Shortcuts e, r, t,
  c, a, b.
- Primary action: Edit.
- **Edit**: copies the text into a new temporary file named `<id>.md`,
  releases the terminal, runs the editor (section 9) on it, then restores
  the screen. If the text changed, it replaces the text in the item file,
  keeping the title and tags as they are on disk. The temporary file is
  removed. The editor's exit status is ignored.
- **Retitle**: `Title` entry pre-filled with the current title. Enter with a
  non-empty title saves it, trimmed and with tabs replaced by spaces, to the
  item file. Empty does nothing. Escape
  cancels.
- **Tag**: opens the Tag view for this prompt. Leaving the Tag view returns
  to the Open view.
- **Archive**: as in the list view, for this prompt.
- **Copy**: copies the text to the system clipboard using the first
  available of `pbcopy`, `wl-copy`, `xclip -selection clipboard`,
  `xsel --clipboard --input`. When the text is blank (empty or only
  whitespace), the title is copied instead. Shows the status message `Copied` or an
  error message if none is available or the command fails.
- **Back**, Escape, q: return to the list view.

### Tag view

- Title bar: `Tags › <title>`, right: the prompt ID.
- Body: the prompt's tags, one per row, first selected.
- Buttons: **Add, Remove, Back** (a, r, b).
- Primary action: Add.
- **Back**, Escape, q: return to the view the Tag view was opened from.
- **Add**: `Tag` entry. As the user types, the first tag in use across all
  prompts that starts with the text (case-insensitive) is shown dim after
  the cursor, with a dim `Tab completes` hint at the right of the line. Tab
  or Right accepts it. Enter commits: the tag is trimmed, must be non-empty
  and contain only letters, digits, `-` and `_` (`[A-Za-z0-9_-]+`), and is added unless the prompt already has it
  (case-insensitive). When an existing tag matches case-insensitively, the
  existing spelling, including an archived prompt's, is used. A successful commit, including a duplicate,
  closes the entry, stays in the Tag view, and selects the tag (the new
  one, or the existing match). Any other character shows the error
  `tags use only letters, numbers, - and _`, closes the entry, and stays
  in the Tag view. Escape cancels.
- **Remove**, Delete, Backspace: remove the selected tag. No-op when empty.
- Changes are written to the item file immediately.

### Archive view

- Title bar: `Archive`, right: `N archived`.
- Body: archived prompts, newest ID first, drawn as in the list view.
  Empty shows `archive is empty`, or `no matches` while a search hides
  everything.
- Buttons: **Open, Restore, /Search, Back** (o, r, /, b).
- Primary action: Open.
- **Open**: the Archived view for the selected prompt.
- **Restore**: moves the selected prompt's file back to `items/`, places it
  first in the sort order and selects it in the list view, and shows
  `Restored <title>`. The archive view stays open.
- **/Search**: as in the list view, over the archived prompts. The archive
  view's search is separate from the list view's and is cleared when the
  view closes.
- **Back**, Escape, q: return to the list view.

### Archived view

- Title bar: `Archived › <title>` followed by the tag chips, right: the
  prompt ID.
- Body and separator as in the Open view, with the path in `archive/`.
  Empty text shows `empty`.
- Buttons: **Restore, Back** (r, b). The text cannot be edited.
- **Restore**: as in the archive view, then returns to the archive view.
- **Back**, Escape, q: return to the archive view.

### Settings view

- Title bar: `Settings`.
- Body: one row per setting, `editor: vim`, first selected.
- Buttons: **Edit, Back** (e, b).
- Primary action: Edit.
- **Edit**: an entry labeled with the setting name, pre-filled. Enter saves
  to `settings.txt`, Escape cancels.
- Settings: `editor`, a shell command. Empty removes the key.

## 6. Sort order

- `sort.txt` lists IDs, one per line, top to bottom.
- Displayed order: prompts not listed in `sort.txt` first, newest ID first,
  then prompts in `sort.txt` order. IDs in `sort.txt` with no matching prompt
  are ignored and dropped on the next write.
- Move mode (section 4) moves the selected prompt by N positions within the
  displayed (searched) list, stopping at the ends. The full
  order is then written to `sort.txt`, with the moved prompt placed
  immediately before (up) or after (down) the displayed prompt that
  occupied its new position. Every prompt is listed after any write.
- A move that changes nothing, such as Up at the top, writes nothing.

## 7. Text entries

- Printable characters insert at the cursor. Tabs inside pasted text are
  inserted as spaces; a lone Tab key is not text (below). Left/Right move the cursor.
  Backspace and Delete edit. Home/End jump.
- Enter commits, Escape cancels. Tab accepts a completion when one is
  shown and is otherwise ignored.
- No other key binding, including shortcut letters, is active while an
  entry is open, except ^C.

## 8. IDs

Format `YYYYMMDD-HHMMSS` in local time at creation. If that ID already
exists, append `-2`, `-3`, and so on until free. Sorting "newest first" for
unsorted prompts compares IDs as strings, descending.

## 9. Editor

Command resolution: `editor` setting, else `$EDITOR`, else `vi`. The value
is a shell command. It runs as `sh -c '<value> "$@"' sh <file>`, so quoting
and flags in the value work as they would in a shell. The child inherits
the terminal.

## 10. Messages

A write failure, a clipboard failure, a reload failure, or a tag
validation problem shows one red line above the buttons. `Copied` shows in
green. The message disappears on the next key press.

## 11. Command-line flags

For scripts and AI agents. Flags never render the UI, need no terminal and
never prompt. Only `--init` creates `.prompts`, and only `--upgrade`
upgrades it. The positional directory may appear before or after the
flags. A flag's value is given as `--flag=value` or `--flag value`. Exactly
one command flag may be given, with the options it accepts.

| Command | Effect and output |
| --- | --- |
| `--list [--search=QUERY]` | One line per prompt in display order (section 6): `ID<TAB>title<TAB>tags`, tags joined by `,` with no spaces, empty when none. No header. `--search` keeps prompts matching QUERY, as the list view's search does. |
| `--show=ID` | The prompt's text exactly as stored. Works for active and archived prompts. |
| `--write=ID` | Replaces the text with stdin exactly as given. No output. |
| `--create --title=TITLE [--tags=TAGS]` | Creates a prompt as New does (first in the sort order), with the text from stdin exactly as given, and prints `ID` and a newline. Tabs in the title become spaces; the title is trimmed. |
| `--retitle=ID --title=TITLE` | Changes the title, as Retitle does. No output. |
| `--tag=ID --tags=TAGS` | Adds the tags the prompt does not already have. No output. |
| `--untag=ID --tags=TAGS` | Removes the listed tags, case-insensitively; tags the prompt does not have are ignored. Tag characters are not checked. No output. |
| `--move=ID --to=N` | Moves the prompt to position N (1 is the top) of the display order, or to the bottom when N is past the end. No output. |
| `--archive=ID` | Moves the prompt to `archive/` at once, as Quit does for marked prompts. No output. |
| `--restore=ID` | Restores an archived prompt, as Restore does. No output. |
| `--list-archive [--search=QUERY]` | Archived prompts, newest ID first, in the `--list` format. |
| `--settings` | The settings in `settings.txt` syntax, unset keys omitted. |
| `--set=KEY=VALUE` | Sets a setting; VALUE is trimmed and empty removes it. KEY must be a setting from the Settings view. No output. |
| `--init` | Creates `.prompts` as Setup does. Fails if it exists. No output. |
| `--upgrade` | Upgrades a version 0 `.prompts` as step 5 of section 1 does. Does nothing when it is already version 1. No output. |
| `--help` | Usage text on stdout, covering every flag, the output formats, the exit codes, and one example per command. |

`TAGS` is comma-separated; entries are trimmed and empty ones dropped.
Tags for `--create` and `--tag` must satisfy the Tag view's rule, and reuse
an existing tag's spelling when one matches case-insensitively; duplicates
are dropped. Commands that change a prompt need an active (not archived)
one.

Errors print to stderr:

- Exit 2, followed by `Run prompts --help for usage.`: an unknown flag,
  more than one command, a missing value, an option the command does not
  accept (`--title requires --create or --retitle`), a command missing a
  required option (`--create requires --title`), or more than one
  positional argument. `--help` wins over all of these except unknown flags
  and missing values.
- Exit 1, one line per problem: no `.prompts` (`<dir>: no .prompts
  directory; run prompts --init, or prompts in a terminal, to set one up`),
  a version 0 `.prompts` for any command but `--upgrade` (`<dir>: .prompts
  is in an older format; run prompts --upgrade, or prompts in a terminal,
  to upgrade it`), validation failures (as in section 1), an unknown ID
  (`no prompt with id "ID"`), an archived ID where an active one is needed
  (`prompt "ID" is archived; restore it first`), an unknown archived ID for
  `--restore` (`no archived prompt with id "ID"`), an invalid tag (`--tags:
  "a b": tags use only letters, numbers, - and _`), no tags (`--tags: no
  tags given`), an empty title or one with a line break, a bad position
  (`--to: "0": expected a position, 1 or more`), a malformed or unknown
  setting, `--init` where `.prompts` exists, or a filesystem error.

Stdin is read only by `--write` and `--create`, and only after the other
checks pass. A reader that closes stdout early (`| head`) is not an error.

## Decisions made without user input

Review these; they were chosen for simplicity.

- Up/Down always act on the body even when a button has focus.
- The body always has focus when a view opens.
- Selected row colors: white on blue when the body has focus, bold otherwise.
- ^C quits everywhere.
- Shortcut letters are bare keys only; Ctrl+letter does nothing.
- Copy's shortcut is `c`; Copy is in both the list view and Open.
- Reload is a button, not only a key.
- Mouse wheel moves the selection rather than scrolling the viewport.
  Clicks do nothing.
- Wrapped titles stay wrapped (no truncation setting).
- The minimum terminal size is 40 by 10.
- ID collisions append `-2`, `-3`.
- Move mode draws the row white on magenta with a `↕` marker and ignores
  every key except the movement keys, Space, Escape and ^C.
- The Open view's tag chips sit inside the inverse title bar, so they are
  not cyan there.
- The `/Search` button sits fourth, so it shows at the 40-column minimum.
- Archived prompts are listed newest ID first; archiving records no time.
- Restore puts the prompt first in the sort order, like New.
- The Archived view has only Restore and Back: archived text is read-only.
- Edit skips writing when the editor left the text unchanged.
- `--init` fails rather than succeeding when `.prompts` exists; `--upgrade`
  succeeds silently when there is nothing to do.
- `--show` reads archived prompts too; the other commands that take an ID
  need an active prompt.
- The upgrade leaves a text file with no index file in `text/`, and keeps
  an edited `README.md`.
