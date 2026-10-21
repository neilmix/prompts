import { Box, Text, useApp } from 'ink';
import { useState } from 'react';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { useCommands } from '../hooks/useCommands.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { vimAction } from '../keys.js';
import { CommandPane, commandPaneHeight } from '../panes/CommandPane.js';
import { Separator } from '../panes/Separator.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';
import { archiveLabel } from '../ListView.js';
import { chips, rangeLabel, wrapText } from '../text.js';

/**
 * A prompt's text. `archived` shows an archived prompt read-only, with
 * Restore and Back (to the archive view) as the only commands.
 */
export function OpenModal({ state, dispatch, actions, size, id, archived = false }: ViewProps & { id: string; archived?: boolean }) {
  const { suspendTerminal } = useApp();
  const prompt = (archived ? state.archived : state.prompts).get(id)!;
  const [top, setTop] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);

  const bottom = editingTitle ? TEXT_INPUT_HEIGHT : 0;
  const bodyHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - 1 - commandPaneHeight(state.message) - bottom);
  const lines = wrapText(prompt.text.replace(/\r?\n$/, ''), size.columns);
  const maxTop = Math.max(0, lines.length - bodyHeight);
  const shownTop = Math.min(top, maxTop);
  const scroll = (by: number) => setTop(Math.max(0, Math.min(maxTop, shownTop + by)));

  const back = () =>
    archived ? dispatch({ type: 'openModal', modal: { kind: 'archive' } }) : dispatch({ type: 'closeModal' });
  const edit = () => void actions.edit(id, suspendTerminal);
  // Back first: opening a view clears the message that restore sets.
  const restore = () => {
    back();
    actions.restore(id);
  };
  const commands = useCommands(
    archived
      ? [
          { label: 'Restore', shortcut: 'r', onActivate: restore },
          { label: 'Back', shortcut: 'b', onActivate: back },
        ]
      : [
          { label: 'Edit', shortcut: 'e', onActivate: edit },
          { label: 'Retitle', shortcut: 'r', onActivate: () => setEditingTitle(true) },
          { label: 'Tag', shortcut: 't', onActivate: () => dispatch({ type: 'openModal', modal: { kind: 'tag', id, from: 'open' } }) },
          { label: 'Copy', shortcut: 'c', onActivate: () => void actions.copy(id) },
          { label: archiveLabel(state.archiving.has(id)), shortcut: 'a', onActivate: () => dispatch({ type: 'toggleArchiving', id }) },
          { label: 'Back', shortcut: 'b', onActivate: back },
        ],
    archived ? () => {} : edit,
  );

  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': scroll(-1); break;
      case 'down': scroll(1); break;
      case 'pageUp': scroll(-Math.max(1, bodyHeight)); break;
      case 'pageDown': scroll(Math.max(1, bodyHeight)); break;
      case 'top': case 'home': setTop(0); break;
      case 'bottom': case 'end': setTop(maxTop); break;
      case 'char': if (a.text === 'q') back(); break;
      case 'wheel': scroll(a.by); break;
    }
  }, !editingTitle);

  const shown = lines.slice(shownTop, shownTop + bodyHeight);
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title={`${archived ? 'Archived' : 'Open'} › ${prompt.title}`} tail={chips(prompt.tags)} right={id} columns={size.columns} />
      <Box flexDirection="column" height={bodyHeight} overflow="hidden">
        {prompt.text === '' ? (
          <Text color="gray">{archived ? 'empty' : 'empty · e to edit'}</Text>
        ) : (
          shown.map((l, i) => (
            <Text key={shownTop + i} wrap="truncate">
              {l === '' ? ' ' : l}
            </Text>
          ))
        )}
      </Box>
      <Separator columns={size.columns} label={archived ? actions.archivePath(id) : actions.itemPath(id)} right={rangeLabel(shownTop, shown.length, lines.length)} />
      {editingTitle && (
        <TextInput
          columns={size.columns}
          label="Title"
          initial={prompt.title}
          onSubmit={(v) => {
            if (v.trim() !== '') actions.rename(id, v);
            setEditingTitle(false);
          }}
          onCancel={() => setEditingTitle(false)}
        />
      )}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} />
    </Box>
  );
}
