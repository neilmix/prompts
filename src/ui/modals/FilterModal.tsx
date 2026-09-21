import { Box } from 'ink';
import { useRef, useState } from 'react';
import { tagCounts, tagEq } from '../../model/select.js';
import { ListBody, GUTTER } from '../controls/ListBody.js';
import type { ViewProps } from '../context.js';
import { useCommands } from '../hooks/useCommands.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { vimAction } from '../keys.js';
import { CommandPane, commandPaneHeight } from '../panes/CommandPane.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';
import { listViewport } from '../text.js';

export function FilterModal({ state, dispatch, size, overlay }: ViewProps) {
  const counts = tagCounts(state.prompts.values());
  const tags = [...counts.keys()];
  const [selected, setSelected] = useState(0);
  const topRef = useRef(0);
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - commandPaneHeight(state.message) - (overlay?.height ?? 0));
  const items = tags.map((t) => `[${state.filter.some((f) => tagEq(f, t)) ? 'x' : ' '}] ${t} (${counts.get(t)})`);
  const view = listViewport(items, selected, listHeight, size.columns - GUTTER, topRef.current);
  topRef.current = view.top;

  const back = () => dispatch({ type: 'closeModal' });
  const toggle = () => {
    const tag = tags[selected];
    if (tag !== undefined) dispatch({ type: 'toggleFilterTag', tag });
  };
  const commands = useCommands(
    [
      { label: 'Back', shortcut: 'b', onActivate: back },
      { label: 'Clear', shortcut: 'l', onActivate: () => dispatch({ type: 'clearFilter' }) },
    ],
    toggle,
  );

  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    const last = Math.max(0, tags.length - 1);
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected((s) => Math.max(0, s - 1)); break;
      case 'down': setSelected((s) => Math.min(last, s + 1)); break;
      case 'pageUp': setSelected((s) => Math.max(0, s - listHeight)); break;
      case 'pageDown': setSelected((s) => Math.min(last, s + listHeight)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(last); break;
      case 'space': toggle(); break;
      case 'char': if (a.text === 'q') back(); break;
      case 'mouse':
        if (a.button === 'wheelUp') setSelected((s) => Math.max(0, s - 1));
        else if (a.button === 'wheelDown') setSelected((s) => Math.min(last, s + 1));
        break;
    }
  }, overlay === null);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="Filter tags" right={`${state.filter.length} selected`} columns={size.columns} />
      <ListBody rows={view.rows} selected={selected} focused={commands.focus === 0} height={listHeight} emptyText="no tags" />
      {overlay?.node}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} />
    </Box>
  );
}
