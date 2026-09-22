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
- Open view: Title is now Retitle (r); new Tag button (t) opens the Tag view
  and returns to the Open view when done.
- Configuring a directory writes a `README.md` into `.prompts` describing the
  directory and linking to the GitHub page.
- Fix: the CLI did nothing when started through a symlinked bin (`npm link`).
- Mouse clicks no longer select rows or activate buttons. The wheel still
  moves the selection.
- Done button shows `✓ Done` instead of `[x] Done`; Done is available in Open.
- The Tags view opens with the Add entry active. Committing a tag closes
  the entry and selects the tag; Back, Escape or q return to the previous
  view.
- List view titles start with a `•` bullet; wrapped lines indent under the
  title text.
- Reordering is now a move mode: Space toggles it, then Up/Down, PageUp/
  PageDown, Home/End and the vim keys move the selected prompt. Replaces
  Shift+arrows, which Terminal.app never sends. Ctrl+arrow and
  Ctrl+Shift+arrow aliases are gone; use PageUp/PageDown and Home/End
  (Fn+arrows on a Mac). The list view shows `press space to reorder`
  centered in the line above the buttons.
- The tag pane is gone. The list view draws each prompt's tags after its
  title in cyan; the Open view shows them in the title bar after the
  title. The range counter moved to the separator above the buttons.
- Ctrl+letter no longer activates buttons; shortcuts are bare keys only
  (^C still quits). Copy's shortcut is now `c` and Copy is available in the
  list view. Copy uses the title when the prompt's text is blank.
