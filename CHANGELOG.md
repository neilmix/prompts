# Changelog

## Unreleased

- Initial documentation.
- Initial implementation: list view, New, Open (Edit, Title), Complete, Tag,
  Filter, Settings, Leave.
- UX pass: focus model (Left/Right/Tab between list and buttons, Enter opens),
  underlined shortcut letters, gutter marker and focus-dependent row style,
  single-spaced list, separator labels and range counters, tag chips,
  empty-state hints, message line above buttons, search with `/`, Copy to
  clipboard, Reload, Done replaces Complete (^D), Quit replaces Leave (^Q,
  ^C) with confirmation and a summary, New opens the editor at once, typing
  in Tags starts Add and Delete removes, filter tag counts, vim keys
  (j k g G q), Escape clears search and filter, mouse click and wheel,
  editor runs through `sh -c`, minimum terminal size guard.
- Button shortcut letters are bare keys (n, o, d, ...) as well as Ctrl+letter.
  Typing in the Tags view no longer starts Add; press `a`.
- A directory without `.prompts` now prompts to configure it instead of
  auto-creating (empty dir) or refusing (non-empty dir).
- Fix: the CLI did nothing when started through a symlinked bin (`npm link`).
- Done button shows `✓ Done` instead of `[x] Done`; Done is available in Open.
- The Tags view opens with the Add entry active, and committing a tag
  returns to the list view. Escape leaves the entry to show the tag list.
- List view titles start with a `•` bullet; wrapped lines indent under the
  title text.
- Ctrl+letter no longer activates buttons; shortcuts are bare keys only
  (^C still quits). Copy's shortcut is now `c` and Copy is available in the
  list view. Copy uses the title when the prompt's text is blank.
