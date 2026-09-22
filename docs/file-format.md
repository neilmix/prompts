# The `.prompts` directory

All state lives in `<dir>/.prompts`. Every file is UTF-8 text with `\n` line
endings so that it diffs cleanly under version control.

```
.prompts/
  README.md
  settings.txt
  sort.txt
  index/
    20260921-143005.txt
  text/
    20260921-143005.txt
```

## `README.md`

Written once when the directory is created and never read. It says what the
directory is for and links to https://github.com/neilmix/prompts. Deleting or
editing it has no effect.

## Settings file syntax

Used by `settings.txt` and every file in `index/`.

- One entry per line: `key: value`. The separator is a colon followed by one
  space. The value is the rest of the line, trimmed.
- Keys match `[A-Za-z0-9_-]+`. Keys are unique within a file.
- Blank lines are ignored. There are no comments.
- The file is rewritten in full on every save, keys in the order listed
  below for that file type.

## `settings.txt`

| Key | Required | Meaning |
| --- | --- | --- |
| `editor` | no | Shell command that opens a file for editing. Overrides `$EDITOR`. |

## `index/<id>.txt`

Metadata for one prompt.

| Key | Required | Meaning |
| --- | --- | --- |
| `title` | yes | Non-empty after trimming. |
| `tags` | no | Comma-separated tags. Each tag is trimmed. Empty entries are dropped. A missing key or empty value means no tags. |

Tags may not contain commas. Tags compare case-insensitively; the stored
spelling is whatever was first entered.

## `text/<id>.txt`

The prompt body. Any content. Created empty. Only the editor writes it.

A prompt exists when its index file exists. A text file without an index
file is ignored. An index file without a text file is valid; the text is
treated as empty and the file is created on first edit.

## `sort.txt`

One prompt ID per line, top of list first. See spec.md section 6 for how
unlisted and stale IDs are handled. May be empty.

## IDs

`YYYYMMDD-HHMMSS`, optionally followed by `-N` for collisions. The file
name in `index/` and `text/` is `<id>.txt`.

## Validation

Performed on startup. Any failure aborts the app with the reasons on stderr.

- `settings.txt` must parse. Unknown keys are errors.
- Every `index/*.txt` must parse and have a non-empty `title`. Unknown keys
  are errors. A tag containing a comma cannot occur by construction, so no
  check is needed.
- `sort.txt` lines that are not well-formed IDs are errors. Unknown IDs are
  not errors.
- `index/` and `text/` must exist and be directories. `settings.txt` and
  `sort.txt` must exist; either may be empty.
