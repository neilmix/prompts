import { Box } from 'ink';
import { useState } from 'react';
import { allTags, tagEq } from '../../model/select.js';
import { ScrollList } from '../controls/ScrollList.jsx';
import type { ViewProps } from '../context.js';
import { useButtons } from '../hooks/useButtons.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { CommandPane, COMMAND_PANE_HEIGHT } from '../panes/CommandPane.jsx';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.jsx';

export function FilterModal({ state, dispatch, size }: ViewProps) {
  const tags = allTags(state.prompts.values());
  const [selected, setSelected] = useState(0);
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - COMMAND_PANE_HEIGHT);

  const back = () => dispatch({ type: 'closeModal' });
  const buttons = useButtons([
    { label: 'Back', shortcut: 'b', onActivate: back },
    { label: 'Clear', shortcut: 'c', onActivate: () => dispatch({ type: 'clearFilter' }) },
  ]);

  useKeyActions((a) => {
    if (buttons.handle(a)) return;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected((s) => Math.max(0, s - 1)); break;
      case 'down': setSelected((s) => Math.min(tags.length - 1, s + 1)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(Math.max(0, tags.length - 1)); break;
      case 'space': {
        const tag = tags[selected];
        if (tag !== undefined) dispatch({ type: 'toggleFilterTag', tag });
        break;
      }
    }
  });

  const items = tags.map((t) => `[${state.filter.some((f) => tagEq(f, t)) ? 'x' : ' '}] ${t}`);
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="Filter tags" />
      <ScrollList items={items} selected={selected} height={listHeight} width={size.columns} gap={0} emptyText="no tags" />
      <CommandPane buttons={buttons.buttons} selected={buttons.selected} error={state.error} columns={size.columns} />
    </Box>
  );
}
