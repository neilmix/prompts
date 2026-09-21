import { Box } from 'ink';
import { visibleIds } from '../model/select.js';
import { ScrollList } from './controls/ScrollList.jsx';
import { selectedPrompt, type ViewProps } from './context.js';
import { useButtons } from './hooks/useButtons.js';
import { useKeyActions } from './hooks/useKeyActions.js';
import { CommandPane, COMMAND_PANE_HEIGHT } from './panes/CommandPane.jsx';
import { TagPane, tagPaneHeight } from './panes/TagPane.jsx';

export function ListView({ state, dispatch, actions, size }: ViewProps) {
  const ids = visibleIds(state);
  const selected = selectedPrompt(state);
  const selectedIndex = selected ? ids.indexOf(selected.id) : -1;
  const tags = selected?.tags ?? [];
  const listHeight = size.rows - tagPaneHeight(tags, size.columns) - COMMAND_PANE_HEIGHT;
  const header = state.filter.length > 0 ? `Filter: ${state.filter.join(', ')}` : undefined;
  const page = Math.max(1, listHeight - (header === undefined ? 0 : 1));

  const withSelected = (f: (id: string) => void) => () => {
    if (selected) f(selected.id);
  };
  const buttons = useButtons([
    { label: 'New', shortcut: 'n', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'new' } }) },
    { label: 'Open', shortcut: 'o', onActivate: withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'open', id } })) },
    {
      label: `[${selected && state.completed.has(selected.id) ? 'x' : ' '}] Complete`,
      shortcut: 'c',
      onActivate: withSelected((id) => dispatch({ type: 'toggleComplete', id })),
    },
    { label: 'Tag', shortcut: 't', onActivate: withSelected((id) => dispatch({ type: 'openModal', modal: { kind: 'tag', id } })) },
    { label: 'Filter', shortcut: 'f', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'filter' } }) },
    { label: 'Settings', shortcut: 's', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'settings' } }) },
    { label: 'Leave', shortcut: 'l', onActivate: () => actions.leave() },
  ]);

  useKeyActions((a) => {
    if (buttons.handle(a)) return;
    switch (a.type) {
      case 'up': dispatch({ type: 'move', by: -1 }); break;
      case 'down': dispatch({ type: 'move', by: 1 }); break;
      case 'pageUp': dispatch({ type: 'move', by: -page }); break;
      case 'pageDown': dispatch({ type: 'move', by: page }); break;
      case 'top': case 'home': dispatch({ type: 'top' }); break;
      case 'bottom': case 'end': dispatch({ type: 'bottom' }); break;
      case 'moveUp': actions.move('up'); break;
      case 'moveDown': actions.move('down'); break;
    }
  });

  const items = ids.map((id) => {
    const p = state.prompts.get(id)!;
    return (state.completed.has(id) ? '✓ ' : '') + p.title;
  });

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <ScrollList items={items} selected={selectedIndex} height={listHeight} width={size.columns} emptyText="no prompts" header={header} />
      <TagPane tags={tags} columns={size.columns} />
      <CommandPane buttons={buttons.buttons} selected={buttons.selected} error={state.error} columns={size.columns} />
    </Box>
  );
}
