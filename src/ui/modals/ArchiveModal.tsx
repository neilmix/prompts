import { Box } from 'ink';
import { useRef, useState } from 'react';
import { archivedIds } from '../../model/select.js';
import { ListBody, GUTTER } from '../controls/ListBody.js';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { useCommands } from '../hooks/useCommands.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { vimAction } from '../keys.js';
import { BULLET, listHeader, SEARCH_LABEL } from '../ListView.js';
import { CommandPane, commandPaneHeight } from '../panes/CommandPane.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';
import { chips, listViewport, rangeLabel } from '../text.js';

/** Archived prompts, newest first, with their own search. */
export function ArchiveModal({ state, dispatch, actions, size }: ViewProps) {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const topRef = useRef(0);
  const ids = archivedIds(state.archived, search);
  const sel = Math.min(selected, Math.max(0, ids.length - 1));
  const id = ids[sel];
  const header = listHeader(search, ids.length, state.archived.size);
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - commandPaneHeight(state.message) - (searching ? TEXT_INPUT_HEIGHT : 0));
  const bodyHeight = Math.max(0, listHeight - (header === undefined ? 0 : 1));
  const items = ids.map((i) => {
    const p = state.archived.get(i)!;
    return { text: p.title, tail: chips(p.tags) };
  });
  const view = listViewport(items, id === undefined ? -1 : sel, bodyHeight, size.columns - GUTTER, topRef.current, BULLET);
  topRef.current = view.top;

  const back = () => dispatch({ type: 'closeModal' });
  const open = () => {
    if (id !== undefined) dispatch({ type: 'openModal', modal: { kind: 'archived', id } });
  };
  const commands = useCommands(
    [
      { label: 'Open', shortcut: 'o', onActivate: open },
      { label: 'Restore', shortcut: 'r', onActivate: () => id !== undefined && actions.restore(id) },
      { label: SEARCH_LABEL, shortcut: '/', onActivate: () => setSearching(true) },
      { label: 'Back', shortcut: 'b', onActivate: back },
    ],
    open,
  );

  const last = Math.max(0, ids.length - 1);
  const page = Math.max(1, bodyHeight);
  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected(Math.max(0, sel - 1)); break;
      case 'down': setSelected(Math.min(last, sel + 1)); break;
      case 'pageUp': setSelected(Math.max(0, sel - page)); break;
      case 'pageDown': setSelected(Math.min(last, sel + page)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(last); break;
      case 'char': if (a.text === 'q') back(); break;
      case 'wheel': setSelected(Math.min(last, Math.max(0, sel + a.by))); break;
    }
  }, !searching);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="Archive" right={`${state.archived.size} archived`} columns={size.columns} />
      <ListBody rows={view.rows} selected={sel} focused={commands.focus === 0} height={listHeight} emptyText={search === '' ? 'archive is empty' : 'no matches'} header={header} />
      {searching && (
        <TextInput
          columns={size.columns}
          label="Search"
          initial={search}
          onChange={(v) => {
            setSearch(v);
            setSelected(0);
          }}
          onSubmit={() => setSearching(false)}
          onCancel={() => {
            setSearch('');
            setSearching(false);
          }}
        />
      )}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} right={rangeLabel(view.top, view.rows.length, view.total)} />
    </Box>
  );
}
