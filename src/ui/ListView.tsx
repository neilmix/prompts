import { Box } from 'ink';
import { useRef, useState } from 'react';
import { visibleIds } from '../model/select.js';
import { ListBody, GUTTER } from './controls/ListBody.js';
import { TextInput, TEXT_INPUT_HEIGHT } from './controls/TextInput.js';
import { selectedPrompt, type ViewProps } from './context.js';
import { buttonSpans, useCommands } from './hooks/useCommands.js';
import { useKeyActions } from './hooks/useKeyActions.js';
import { vimAction } from './keys.js';
import { CommandPane, commandPaneHeight } from './panes/CommandPane.js';
import { TagPane, tagPaneLines } from './panes/TagPane.js';
import { listViewport, rangeLabel } from './text.js';

export function listHeader(state: { search: string; filter: string[] }, shown: number, total: number): string | undefined {
  const parts: string[] = [];
  if (state.search !== '') parts.push(`Search: ${state.search}`);
  if (state.filter.length > 0) parts.push(`Filter: ${state.filter.join(', ')}`);
  if (parts.length === 0) return undefined;
  parts.push(`${shown} of ${total}`);
  return parts.join(' · ');
}

export function ListView({ state, dispatch, actions, size, overlay }: ViewProps) {
  const [searching, setSearching] = useState(false);
  const topRef = useRef(0);
  const ids = visibleIds(state);
  const selected = selectedPrompt(state);
  const selectedIndex = selected ? ids.indexOf(selected.id) : -1;
  const tags = selected?.tags ?? [];
  const tagLines = tagPaneLines(tags, size.columns);
  const header = listHeader(state, ids.length, state.prompts.size);
  const bottom = overlay ? overlay.height : searching ? TEXT_INPUT_HEIGHT : 0;
  const listHeight = Math.max(0, size.rows - 1 - tagLines.length - commandPaneHeight(state.message) - bottom);
  const bodyHeight = Math.max(0, listHeight - (header === undefined ? 0 : 1));

  const items = ids.map((id) => (state.done.has(id) ? '✓ ' : '') + state.prompts.get(id)!.title);
  const view = listViewport(items, selectedIndex, bodyHeight, size.columns - GUTTER, topRef.current);
  topRef.current = view.top;

  const withSelected = (f: (id: string) => void) => () => {
    if (selected) f(selected.id);
  };
  const open = withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'open', id } }));
  const commands = useCommands(
    [
      { label: 'New', shortcut: 'n', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'new' } }) },
      { label: 'Open', shortcut: 'o', onActivate: open },
      { label: `[${selected && state.done.has(selected.id) ? 'x' : ' '}] Done`, shortcut: 'd', onActivate: withSelected((id) => dispatch({ type: 'toggleDone', id })) },
      { label: 'Tag', shortcut: 't', onActivate: withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'tag', id } })) },
      { label: 'Filter', shortcut: 'f', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'filter' } }) },
      { label: 'Settings', shortcut: 's', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'settings' } }) },
      { label: 'Reload', shortcut: 'r', onActivate: () => actions.reload() },
      { label: 'Quit', shortcut: 'q', onActivate: () => actions.requestQuit() },
    ],
    open,
  );

  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'up': dispatch({ type: 'move', by: -1 }); break;
      case 'down': dispatch({ type: 'move', by: 1 }); break;
      case 'pageUp': dispatch({ type: 'move', by: -Math.max(1, bodyHeight) }); break;
      case 'pageDown': dispatch({ type: 'move', by: Math.max(1, bodyHeight) }); break;
      case 'top': case 'home': dispatch({ type: 'top' }); break;
      case 'bottom': case 'end': dispatch({ type: 'bottom' }); break;
      case 'moveUp': actions.move('up'); break;
      case 'moveDown': actions.move('down'); break;
      case 'escape':
        dispatch({ type: 'setSearch', search: '' });
        dispatch({ type: 'clearFilter' });
        break;
      case 'char':
        if (a.text === 'q') actions.requestQuit();
        else if (a.text === '/') setSearching(true);
        break;
      case 'mouse': {
        if (a.button === 'wheelUp') dispatch({ type: 'move', by: -1 });
        else if (a.button === 'wheelDown') dispatch({ type: 'move', by: 1 });
        else if (a.button === 'left') {
          const bodyTop = header === undefined ? 0 : 1;
          const row = view.rows[a.y - bodyTop];
          if (a.y >= bodyTop && row) {
            dispatch({ type: 'select', id: ids[row.item]! });
            commands.setFocus(0);
          } else if (a.y === size.rows - 1) {
            const hit = buttonSpans(commands.buttons).findIndex((s) => a.x >= s.start && a.x < s.end);
            if (hit >= 0) commands.buttons[hit]!.onActivate();
          }
        }
        break;
      }
    }
  }, !searching && overlay === null);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <ListBody rows={view.rows} selected={selectedIndex} focused={commands.focus === 0} height={listHeight} emptyText="no prompts · ^N to create one" header={header} />
      <TagPane tags={tags} columns={size.columns} right={rangeLabel(view.top, view.rows.length, view.total)} />
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
      {overlay?.node}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} />
    </Box>
  );
}
