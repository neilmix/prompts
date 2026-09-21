# Behavior specification

This document is the source of truth for what `prompts` does. Tests are
derived from it. When behavior changes, change this file in the same commit.

Terms: a **prompt** is one item, made of a title, tags, and a text body. The
**store** is the `.prompts` directory (see [file-format.md](file-format.md)).
`^X` means Ctrl+X. A button's shortcut letter works bare or with Ctrl.

## 1. Startup

1. Resolve the target directory: the first CLI argument, else the current
   working directory. A missing directory is an error.
2. If `<dir>/.prompts` exists, load and validate it. Validation failures
   (see file-format.md, "Validation") print one line per problem to stderr
   and exit with status 1. Nothing is rendered.
3. Stdin and stdout must both be terminals from here on. Otherwise print
   `prompts needs an interactive terminal` to stderr and exit with status 1.
4. If `<dir>/.prompts` does not exist, show the directory and ask
   `This directory is not configured for prompts. Configure now? (y/n)` in
   the normal screen. `y` creates `.prompts/` with `settings.txt`,
   `sort.txt`, `index/`, and `text/`, then continues. `n`, Escape, or ^C
   exits with status 0 and creates nothing.
5. The app runs in the terminal's alternate screen.
6. If the terminal is smaller than 40 columns by 10 rows, the whole screen
   shows `terminal too small` and only ^C and ^Q work.

## 2. Screen layout

Every view is a stack of panes filling the terminal:

- **Title bar** (modals only): one inverse line. Left: `View › Title`.
  Right: a dim detail such as the prompt ID.
- **Body**: a list or a text pane. Scrolls when it overflows.
- **Tag pane** (list view and Open): the selected prompt's tags as chips,
  `[work] [urgent]`, wrapping. Blank when there are no tags.
- **Input pane** (when a text entry is active): one separator, then
  `Label: value`.
- **Command pane**: a separator, an optional message line, then the buttons.

Separators are full-width `─` lines. A separator may carry a dim label on
its left, e.g. `─ tags ────`, and a dim counter on its right, e.g.
`── 3–9 of 42 ─` when the body above it overflows.

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
- Shortcut letters (bare, or with Ctrl) work no matter which target has
  focus. They are lowercase; `G` is not a shortcut for `g`.
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
| ^Up, PageUp | Up one page (the body height in rows) |
| ^Down, PageDown | Down one page |
| ^Shift+Up, Home, g | First row / top |
| ^Shift+Down, End, G | Last row / bottom |
| Shift+Up / Shift+Down | List view only: move the selected prompt in the sort order (section 6) |
| q | List view: Quit (also its button shortcut). Modals: Back |
| Escape | List view: clear search and tag filter. Modals: Back |

Rows stay visible: the body scrolls the minimum needed to show the whole
selected row.

Mouse, when the terminal reports it: clicking a body row selects it,
clicking a button activates it, wheel up / down moves the selection (or
scrolls text) one row.

## 5. Views

### List view

- Body: prompt titles, single-spaced, one row per prompt. A wrapped title
  continues on following lines indented under the gutter. Done prompts
  are prefixed `✓ `.
- The first body line, when a search or filter is active, is a yellow
  header: `Search: foo · Filter: work, urgent · 2 of 7`. Segments that do
  not apply are omitted.
- Tag pane shows the selected prompt's tags.
- Buttons: **New, Open, Done, Tag, Filter, Settings, Reload, Quit**. Each
  button's shortcut letter is underlined: n, o, d, t, f, s, r, q.
- Primary action (Enter on body): Open.
- `/` opens the search entry (below).

**New (n)**: title bar `New prompt`, a `Title` entry. Enter with a
non-empty (trimmed) title creates the prompt with a new ID, an index file,
and an empty text file, places it first in the sort order, selects it,
then immediately runs the editor on it (as Edit does). On return, the list
view is shown. Enter with an empty title does nothing. Escape cancels.

**Open (o)**: see the Open view.

**Done (d)**: toggles the selected prompt's done flag, in memory only. The
button reads `Done`, or `✓ Done` when the selected prompt is done. Nothing
is deleted until Quit.

**Tag (t)**, **Filter (f)**, **Settings (s)**: see those views.

**Reload (r)**: rereads `.prompts` from disk. Selection, filter, search and
done flags are kept where the IDs still exist. If the reread fails
validation, the current state is kept and the first problem is shown as an
error message.

**Quit (q, also ^C in every view)**: if no prompt is marked done, exit
immediately. Otherwise the input pane asks `Delete N done prompt(s)? (y/n)`.
`y` deletes each done prompt's index file, text file and sort line, then
exits. `n` or Escape cancels. After the alternate screen closes, the app
prints `Deleted N prompt(s).` to stdout when N > 0. Exit status is 0.

**Search (`/`)**: a `Search` entry in the input pane. The list filters live
as the user types: a prompt matches when its title contains the text,
case-insensitively. Enter keeps the search and closes the entry. Escape
clears the search and closes the entry. Search combines with the tag
filter (both must match). Search is not persisted.

### Open view

- Title bar: `Open › <title>`, right: the prompt ID.
- Body: the text file, scrollable. A single trailing newline is not shown
  as a blank line. Empty text shows the empty hint.
- The separator below the body is labeled with the text file's relative
  path, e.g. `─ .prompts/text/20260921-143005.txt ─`.
- Tag pane shows the prompt's tags.
- Buttons: **Edit, Title, Copy, Done, Back**. Shortcuts e, t, y (Copy's `y`
  is underlined), d, b.
- Primary action: Edit.
- **Edit**: releases the terminal, runs the editor (section 9) on the text
  file, then restores the screen and reloads the text. The editor's exit
  status is ignored.
- **Title**: `Title` entry pre-filled with the current title. Enter with a
  non-empty title saves it to the index file. Empty does nothing. Escape
  cancels.
- **Done**: as in the list view, for this prompt.
- **Copy**: copies the text to the system clipboard using the first
  available of `pbcopy`, `wl-copy`, `xclip -selection clipboard`,
  `xsel --clipboard --input`. Shows the status message `Copied` or an
  error message if none is available or the command fails.
- **Back**, Escape, q: return to the list view.

### Tag view

- Title bar: `Tags › <title>`, right: the prompt ID.
- Body: the prompt's tags, one per row, first selected.
- Buttons: **Add, Remove, Back** (a, r, b).
- Primary action: Add.
- **Add**: `Tag` entry. As the user types, the first tag in use across all
  prompts that starts with the text (case-insensitive) is shown dim after
  the cursor, with a dim `Tab completes` hint at the right of the line. Tab
  or Right accepts it. Enter commits: the tag is trimmed, must be non-empty
  and contain no comma, and is added unless the prompt already has it
  (case-insensitive). When an existing tag matches case-insensitively, the
  existing spelling is used. Escape cancels.
- **Remove**, Delete, Backspace: remove the selected tag. No-op when empty.
- Changes are written to the index file immediately.

### Filter view

- Title bar: `Filter tags`, right: `N selected`.
- Body: every tag in use, deduplicated and sorted case-insensitively, as
  `[x] work (4)` where the number is how many prompts carry the tag.
- Buttons: **Back, Clear** (b, l). `l` is underlined because ^C quits.
- Primary action and Space: toggle the selected tag.
- **Clear**: uncheck every tag.
- A prompt passes the filter when it has every checked tag. No checked tags
  means every prompt passes. The filter is not persisted.

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
- Shift+Up / Shift+Down swap the selected prompt with its neighbor in the
  displayed (filtered and searched) list. The full order is then written to
  `sort.txt`, with the moved prompt placed immediately before (up) or after
  (down) that neighbor. Every prompt is listed after any write.
- Moving past either end does nothing.

## 7. Text entries

- Printable characters insert at the cursor. Left/Right move the cursor.
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

## Decisions made without user input

Review these; they were chosen for simplicity.

- Up/Down always act on the body even when a button has focus.
- The body always has focus when a view opens.
- Selected row colors: white on blue when the body has focus, bold otherwise.
- Done replaces Complete. ^C quits everywhere.
- Shortcut letters are bare keys; Ctrl+letter still works.
- Copy's shortcut is ^Y (the underlined `y` in Copy).
- Reload is a button, not only a key.
- Mouse wheel moves the selection rather than scrolling the viewport.
- Wrapped titles stay wrapped (no truncation setting).
- The minimum terminal size is 40 by 10.
- ID collisions append `-2`, `-3`.
