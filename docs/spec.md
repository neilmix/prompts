# Behavior specification

This document is the source of truth for what `prompts` does. Tests are
derived from it. When behavior changes, change this file in the same commit.

Terms: a **prompt** is one item, made of a title, tags, and a text body. The
**store** is the `.prompts` directory (see [file-format.md](file-format.md)).

## 1. Startup

1. Resolve the target directory: the first CLI argument, else the current
   working directory. A missing directory is an error.
2. If `<dir>/.prompts` exists, load and validate it.
3. Otherwise, if `<dir>` has no entries other than `.git`, create
   `.prompts/` with `settings.txt`, `sort.txt`, `index/`, and `text/`.
4. Otherwise print `Not a prompts directory` to stderr and exit with
   status 1.
5. Validation failures (see file-format.md, "Validation") print one line per
   problem to stderr and exit with status 1. Nothing is rendered.

## 2. Screen layout

Three stacked panes fill the terminal:

- **List pane**: titles of prompts that pass the current filter, in sort
  order, one blank line between items. Long titles wrap. Scrolls when the
  content overflows. Shows `no prompts` in dark gray when empty.
- **Tag pane**: tags of the selected prompt, space separated, wrapping.
  Empty when nothing is selected.
- **Command pane**: the available command buttons for the current context.

Modals replace the list and tag panes but keep the same three-pane shape:
title bar, body, command pane.

## 3. Selection and focus

- If at least one prompt is listed, exactly one is selected and rendered
  highlighted. The first item is selected at startup and after the selected
  item disappears (filter change, deletion).
- Exactly one command button is selected at a time, defaulting to the first
  button of the current pane. Selection resets to the first button whenever
  the command pane changes.
- List selection and button selection are independent. Arrow keys move the
  list selection. Tab moves the button selection. Enter activates
  the selected button.

## 4. Keys in list view

| Key | Action |
| --- | --- |
| Up / Down | Select previous / next item. Stops at the ends. |
| Ctrl+Up / Ctrl+Down | Move selection by one page. The page height is the list pane height in lines. |
| Ctrl+Shift+Up, Home | Select the first item. |
| Ctrl+Shift+Down, End | Select the last item. |
| Shift+Up / Shift+Down | Move the selected item one position up / down in the sort order (section 6). |
| Tab | Select the next button, wrapping. |
| Enter | Activate the selected button. |
| Ctrl+letter | Activate the button whose label starts with that letter. |

Ctrl+letter shortcuts apply in every command pane, including modals. Ctrl+C
therefore means Complete in list view and does not exit the app.

The selected item stays visible: the list scrolls the minimum needed to keep
the whole selected item on screen.

## 5. Commands in list view

Buttons, in order: **New, Open, Complete, Tag, Filter, Settings, Leave**.

### New (Ctrl+N)

- Opens a modal with title bar `New prompt` and a single-line text input.
- Enter with a non-empty (after trimming) title creates the prompt: a new ID,
  an index file with the title and no tags, and an empty text file. The new
  prompt is placed first in the sort order and becomes selected. Returns to
  list view.
- Enter with an empty title does nothing.
- Escape cancels.

### Open (Ctrl+O)

Opens a modal for the selected prompt:

- Title bar: the prompt title.
- Body: the text file contents, scrollable with Up/Down (one line) and
  Ctrl+Up/Ctrl+Down (one page). Home/End jump to the ends. Empty text shows
  `empty` in dark gray.
- Tag pane: the prompt's tags.
- Buttons: **Edit, Title, Back**.
- **Edit (Ctrl+E)**: suspends the UI, runs the editor (section 9) on the text
  file, then resumes and reloads the text. Editor exit status is ignored.
- **Title (Ctrl+T)**: shows a single-line text input pre-filled with the
  current title in a pane at the bottom of the screen, above the command
  pane. Enter with a non-empty title saves it to the index file. Empty
  title does nothing. Escape closes the input without saving.
- **Back (Ctrl+B)** and Escape return to list view.

### Complete (Ctrl+C)

- Toggles the selected prompt's completed flag. The flag is in memory only.
- The button reads `[ ] Complete` when the selected prompt is not completed
  and `[x] Complete` when it is.
- Completed items render with a `✓ ` prefix in the list.
- Nothing is deleted until Leave.

### Tag (Ctrl+T)

Opens a modal for the selected prompt:

- Title bar: the prompt title.
- Body: scrollable list of the prompt's tags, first one selected. `no tags`
  in dark gray when empty.
- Buttons: **Add, Remove, Back**.
- **Add (Ctrl+A)**: single-line text input at the bottom of the screen. As
  the user types, the first existing tag (across all prompts, compared
  case-insensitively, prefix match) that matches is shown as a dim
  completion after the cursor. Right arrow or Tab accepts the completion.
  Enter commits: the tag is trimmed, must be non-empty, must not contain a
  comma, and is added if the prompt does not already have it
  (case-insensitive). If an existing tag matches case-insensitively, the
  existing spelling is used. Escape cancels.
- **Remove (Ctrl+R)**: removes the selected tag from the prompt. Nothing
  happens when the list is empty.
- **Back (Ctrl+B)** and Escape return to list view.
- Changes are written to the index file immediately.

### Filter (Ctrl+F)

- Title bar: `Filter tags`.
- Body: every tag in use across all prompts, deduplicated
  case-insensitively, sorted case-insensitively, each with a checkbox.
  Up/Down move, Space toggles the highlighted tag. Enter activates the
  selected button, so it does not toggle.
- Buttons: **Back, Clear**.
- **Clear (Ctrl+C)** unchecks every tag.
- **Back (Ctrl+B)** and Escape return to list view with the filter applied.
- A prompt is listed when it has every checked tag (AND). No checked tags
  means every prompt is listed.
- When a filter is active, the list pane's first line reads
  `Filter: tag1, tag2` in dark gray.
- The filter is not persisted. It is empty on every start.

### Settings (Ctrl+S)

- Title bar: `Settings`.
- Body: scrollable list of setting names with their current values, formatted
  `editor: vim`. First selected.
- Buttons: **Edit, Back**.
- **Edit (Ctrl+E)** shows the editing control for the selected setting in a
  pane at the bottom of the screen. The settings list stays visible above.
  Enter saves to `settings.txt`, Escape cancels.
- Settings and their controls:
  - `editor`: single-line text input. Empty value removes the key, which
    falls back to `$EDITOR`.
- **Back (Ctrl+B)** and Escape return to list view.

### Leave (Ctrl+L)

- For every completed prompt: delete its index file, its text file, and its
  line in `sort.txt`.
- Exit with status 0.
- Ctrl+C never exits. Terminal close or SIGTERM exits without deleting.

## 6. Sort order

- `sort.txt` lists IDs, one per line, top to bottom.
- Displayed order: prompts not listed in `sort.txt` first, newest ID first,
  then prompts in `sort.txt` order. IDs in `sort.txt` with no matching prompt
  are ignored and dropped on the next write.
- Shift+Up / Shift+Down swap the selected prompt with its neighbor in the
  displayed (filtered) list. The full order of all prompts is then written to
  `sort.txt`, with the moved prompt placed immediately before (up) or after
  (down) that neighbor. Every prompt is listed after any write.
- Moving past either end does nothing.

## 7. Text entry controls

All single-line inputs share behavior:

- Printable characters insert at the cursor. Left/Right move the cursor.
  Backspace and Delete edit. Home/End jump.
- Enter commits, Escape cancels. Tab is consumed by the input (used by the
  tag autocomplete, ignored elsewhere) and does not move button selection.
- Ctrl+letter shortcuts are disabled while an input has focus.

## 8. IDs

Format `YYYYMMDD-HHMMSS` in local time at creation. If that ID already
exists, append `-2`, `-3`, and so on until free. Sorting "newest first" for
unsorted prompts compares IDs as strings, descending.

## 9. Editor

Command resolution: `editor` setting, else `$EDITOR`, else `vi`. The value is
split on whitespace; the first token is the program, the rest are arguments,
and the text file path is appended. The child inherits the terminal. The
Ink app is paused while the editor runs.

## 10. Errors at runtime

Write failures (disk full, permissions) show the error message in the
command pane in red until the next key press. The app keeps running.

## Decisions made without user input

Review these; they were chosen for simplicity.

- Startup treats a directory containing only `.git` as empty.
- Space is never a button activator. Enter is the only one. In `Filter`, Space toggles the highlighted tag.
- `Settings` has explicit Edit and Back buttons.
- Completed items show a `✓ ` prefix.
- Tag autocomplete accepts with Tab or Right arrow.
- ID collisions append `-2`, `-3`.
- `editor` setting value is split on whitespace for arguments.
