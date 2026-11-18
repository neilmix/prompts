# The `.prompts` directory

All state lives in `<dir>/.prompts`. Every file is UTF-8 text with `\n` line
endings so that it diffs cleanly under version control.

```
.prompts/
  README.md
  VERSION
  settings.txt
  sort.txt
  items/
    20260921-143005.md
  archive/
    20250102-091500.md
```

## Versions

`VERSION` holds the layout version as a bare number and a newline: `2`.
It is the one file besides `README.md` that does not use the settings
syntax. This document describes version 2.

- No `VERSION` file: version 0, the original layout (below).
- Version 1: as version 2, but each item file's header also held a
  required `title`.
- The app offers to upgrade versions 0 and 1; the command-line flags
  refuse them except `--upgrade`.
- A version newer than the app supports, or a `VERSION` that is not a
  number, is an error.

## `README.md`

Written once when the directory is created and never read. It says what the
directory is for and links to https://github.com/neilmix/prompts. Deleting or
editing it has no effect.

## Settings file syntax

Used by `settings.txt` and the header of every item file.

- One entry per line: `key: value`. The separator is a colon followed by one
  space. The value is the rest of the line, trimmed.
- Keys match `[A-Za-z0-9_-]+`. Keys are unique within a file.
- Blank lines are ignored in `settings.txt`. There are no comments.
- The file is rewritten in full on every save, keys in the order listed
  below for that file type.

## `settings.txt`

| Key | Required | Meaning |
| --- | --- | --- |
| `editor` | no | Shell command that opens a file for editing. Overrides `$EDITOR`. |

## `items/<id>.md`

One active prompt: a header in the settings syntax, two empty lines, then
the text. The prompt's title is not stored: it is the first sentence of
the text (spec.md, "Title").

```
tags: backend, auth


Refactor the auth middleware. Keep the session API.
It may contain blank lines.
```

| Header key | Required | Meaning |
| --- | --- | --- |
| `tags` | no | Comma-separated tags. Each tag is trimmed. Empty entries are dropped. A missing key or empty value means no tags. |

- The header ends at the first empty line. The text starts after the
  second and runs to the end of the file, kept exactly as given; it need
  not end with a newline. The text must not be blank.
- The app always writes the `tags` line, as `tags:` when there are none,
  so the header is never empty. A file that starts with two empty lines
  has an empty header and is still valid.

New tags contain only letters, digits, `-` and `_` (`[A-Za-z0-9_-]+`).
The rule is enforced on input, not on load, so older tags with other
characters still load. Tags compare case-insensitively; the stored
spelling is whatever was first entered.

## `archive/<id>.md`

An archived prompt, in the same format as `items/`. Archiving and restoring
move the file between the two directories unchanged. An ID is never in
both.

## `sort.txt`

One prompt ID per line, top of list first. See spec.md section 6 for how
unlisted and stale IDs are handled. Archived prompts are dropped from it.
May be empty.

## IDs

`YYYYMMDD-HHMMSS`, optionally followed by `-N` for collisions. The file
name in `items/` and `archive/` is `<id>.md`. New IDs avoid archived IDs.

## Validation

Performed on startup and on Reload. Any failure aborts the app with the
reasons on stderr.

- `settings.txt` must parse. Unknown keys are errors.
- Every file in `items/` and `archive/` must be named `<id>.md` with a
  well-formed ID, have a parseable header, two empty lines after the
  header, and text that is not blank (`empty text`). Unknown header keys,
  `title` included, are errors. A tag containing a comma cannot occur by
  construction, so no check is needed.
- An ID in both `items/` and `archive/` is an error.
- `sort.txt` lines that are not well-formed IDs are errors. Unknown IDs are
  not errors.
- `items/` and `archive/` must exist and be directories. `settings.txt` and
  `sort.txt` must exist; either may be empty.

## Upgrading

Each upgrade moves a prompt's stored title into its text: the text becomes
the title, a newline, an empty line, then the old text, or just the title
and a newline when the old text was empty. A title containing `. ` (or `!`,
`?` before a space) is therefore shortened when derived again.

### From version 1

1. Checks every file in `items/` and `archive/` as version 1 did: a
   `<id>.md` name, a parseable header, a non-empty `title`, no keys besides
   `title` and `tags`. A file with no `title` key was already converted by
   an interrupted upgrade and is skipped. Any problem stops the upgrade
   with nothing changed.
2. Rewrites each file in place in the version 2 format.
3. Replaces `README.md` with the version 2 text if it is the unedited
   version 0 or 1 text.
4. Writes `VERSION`. An upgrade interrupted before this step can be rerun.

### From version 0

Version 0 had no `VERSION`, no `archive/`, and kept each prompt in two
files: `index/<id>.txt` (the header, in the settings syntax) and
`text/<id>.txt` (the text; optional, missing meaning empty). A text file
without an index file was ignored.

The upgrade:

1. Checks every `index/` file: a `<id>.txt` name, a parseable header, a
   non-empty `title`, no unknown keys. Any problem stops the upgrade with
   nothing changed.
2. Writes `items/<id>.md` for each prompt in the version 2 format, creates
   `archive/`, and creates `settings.txt` and `sort.txt` if missing
   (`sort.txt` is kept as is).
3. Replaces `README.md` with the version 2 text if it is the unedited
   version 0 text.
4. Writes `VERSION`. An upgrade interrupted before this step can be rerun.
5. Deletes the `index/` and `text/` files it converted, then each of the
   two directories if empty. Text files with no index file stay in `text/`.
