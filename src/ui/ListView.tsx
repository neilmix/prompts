import { Box } from 'ink';
import { useRef, useState } from 'react';
import { visibleIds } from '../model/select.js';
import { ListBody, GUTTER } from './controls/ListBody.js';
import { TextInput, TEXT_INPUT_HEIGHT } from './controls/TextInput.js';
import { selectedPrompt, type ViewProps } from './context.js';
import { useCommands } from './hooks/useCommands.js';
import { useKeyActions } from './hooks/useKeyActions.js';
import { vimAction, type KeyAction } from './keys.js';
import { CommandPane, commandPaneHeight } from './panes/CommandPane.js';
import { chips, listViewport, rangeLabel } from './text.js';

/** The yellow first body line while a search is active. */
export function listHeader(search: string, shown: number, total: number): string | undefined {
  return search === '' ? undefined : `Search: ${search} · ${shown} of ${total}`;
}

/** Starts each title row; wrapped continuation rows are indented by its width. */
export const BULLET = '• ';

export const archiveLabel = (marked: boolean): string => (marked ? '✓ Archive' : 'Archive');

/** The `/` button that opens the search entry. */
export const SEARCH_LABEL = '/Search';

export function ListView({ state, dispatch, actions, size }: ViewProps) {
  const [searching, setSearching] = useState(false);
  const [moving, setMoving] = useState(false);
  const topRef = useRef(0);
  const ids = visibleIds(state);
  const selected = selectedPrompt(state);
  const selectedIndex = selected ? ids.indexOf(selected.id) : -1;
  const header = listHeader(state.search, ids.length, state.prompts.size);
  const bottom = searching ? TEXT_INPUT_HEIGHT : 0;
  const listHeight = Math.max(0, size.rows - commandPaneHeight(state.message) - bottom);
  const bodyHeight = Math.max(0, listHeight - (header === undefined ? 0 : 1));

  const items = ids.map((id) => {
    const p = state.prompts.get(id)!;
    return { text: (state.archiving.has(id) ? '✓ ' : '') + p.title, tail: chips(p.tags) };
  });
  const view = listViewport(items, selectedIndex, bodyHeight, size.columns - GUTTER, topRef.current, BULLET);
  topRef.current = view.top;

  const withSelected = (f: (id: string) => void) => () => {
    if (selected) f(selected.id);
  };
  const open = withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'open', id } }));
  const commands = useCommands(
    [
      { label: 'New', shortcut: 'n', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'new' } }) },
      { label: 'Open', shortcut: 'o', onActivate: open },
      { label: 'Copy', shortcut: 'c', onActivate: withSelected((id) => void actions.copy(id)) },
      { label: SEARCH_LABEL, shortcut: '/', onActivate: () => setSearching(true) },
      { label: archiveLabel(selected !== null && state.archiving.has(selected.id)), shortcut: 'a', onActivate: withSelected((id) => dispatch({ type: 'toggleArchiving', id })) },
      { label: 'Tag', shortcut: 't', onActivate: withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'tag', id, from: 'list' } })) },
      { label: 'View-archive', shortcut: 'v', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'archive' } }) },
      { label: 'Settings', shortcut: 's', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'settings' } }) },
      { label: 'Reload', shortcut: 'r', onActivate: () => actions.reload() },
      { label: 'Quit', shortcut: 'q', onActivate: () => actions.quit() },
    ],
    open,
  );

  const page = Math.max(1, bodyHeight);

  // Move mode: Space toggles; the body keys move the selected prompt in
  // the sort order instead of moving the selection. Everything else is
  // ignored until Space or Escape leaves the mode.
  const handleMoving = (raw: NonNullable<KeyAction>) => {
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'up': actions.move(-1); break;
      case 'down': actions.move(1); break;
      case 'pageUp': actions.move(-page); break;
      case 'pageDown': actions.move(page); break;
      case 'top': case 'home': actions.move(-ids.length); break;
      case 'bottom': case 'end': actions.move(ids.length); break;
      case 'space': case 'escape': setMoving(false); break;
    }
  };

  useKeyActions((raw) => {
    if (moving) return handleMoving(raw);
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'up': dispatch({ type: 'move', by: -1 }); break;
      case 'down': dispatch({ type: 'move', by: 1 }); break;
      case 'pageUp': dispatch({ type: 'move', by: -page }); break;
      case 'pageDown': dispatch({ type: 'move', by: page }); break;
      case 'top': case 'home': dispatch({ type: 'top' }); break;
      case 'bottom': case 'end': dispatch({ type: 'bottom' }); break;
      case 'space':
        if (selected) setMoving(true);
        break;
      case 'escape': dispatch({ type: 'setSearch', search: '' }); break;
      case 'wheel': dispatch({ type: 'move', by: a.by }); break;
    }
  }, !searching);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <ListBody rows={view.rows} selected={selectedIndex} focused={commands.focus === 0} moving={moving} height={listHeight} emptyText="no prompts · n to create one" header={header} />
      {searching && (
        <TextInput
          columns={size.columns}
          label="Search"
          initial={state.search}
          onChange={(v) => dispatch({ type: 'setSearch', search: v })}
          onSubmit={() => setSearching(false)}
          onCancel={() => {
            dispatch({ type: 'setSearch', search: '' });
            setSearching(false);
          }}
        />
      )}
      <CommandPane
        buttons={commands.buttons}
        focus={commands.focus}
        message={state.message}
        columns={size.columns}
        hint={selected === null ? null : moving ? 'moving · press space when done' : 'press space to reorder'}
        right={rangeLabel(view.top, view.rows.length, view.total)}
      />
    </Box>
  );
}
