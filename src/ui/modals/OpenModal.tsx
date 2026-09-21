import { Box, Text, useApp } from 'ink';
import { useState } from 'react';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.jsx';
import type { ViewProps } from '../context.js';
import { useButtons } from '../hooks/useButtons.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { CommandPane, COMMAND_PANE_HEIGHT } from '../panes/CommandPane.jsx';
import { TagPane, tagPaneHeight } from '../panes/TagPane.jsx';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.jsx';
import { scrollToShow, wrapText } from '../text.js';

export function OpenModal({ state, dispatch, actions, size, id }: ViewProps & { id: string }) {
  const { suspendTerminal } = useApp();
  const prompt = state.prompts.get(id)!;
  const [text, setText] = useState(() => actions.readText(id));
  const [top, setTop] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);

  const bodyHeight = Math.max(
    0,
    size.rows - TITLE_BAR_HEIGHT - tagPaneHeight(prompt.tags, size.columns) - COMMAND_PANE_HEIGHT - (editingTitle ? TEXT_INPUT_HEIGHT : 0),
  );
  const lines = wrapText(text.replace(/\r?\n$/, ''), size.columns);
  const maxTop = Math.max(0, lines.length - bodyHeight);
  const scroll = (by: number) => setTop((t) => Math.max(0, Math.min(maxTop, t + by)));

  const back = () => dispatch({ type: 'closeModal' });
  const buttons = useButtons([
    {
      label: 'Edit',
      shortcut: 'e',
      onActivate: () => {
        void actions.edit(id, suspendTerminal).then(() => {
          setText(actions.readText(id));
          setTop((t) => scrollToShow(t, t, t, bodyHeight, lines.length));
        });
      },
    },
    { label: 'Title', shortcut: 't', onActivate: () => setEditingTitle(true) },
    { label: 'Back', shortcut: 'b', onActivate: back },
  ]);

  useKeyActions((a) => {
    if (buttons.handle(a)) return;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': scroll(-1); break;
      case 'down': scroll(1); break;
      case 'pageUp': scroll(-bodyHeight); break;
      case 'pageDown': scroll(bodyHeight); break;
      case 'top': case 'home': setTop(0); break;
      case 'bottom': case 'end': setTop(maxTop); break;
    }
  }, !editingTitle);

  const shown = lines.slice(top, top + bodyHeight);
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title={prompt.title} />
      <Box flexDirection="column" height={bodyHeight} overflow="hidden">
        {text === '' ? (
          <Text color="gray">empty</Text>
        ) : (
          shown.map((l, i) => (
            <Text key={top + i} wrap="truncate">
              {l === '' ? ' ' : l}
            </Text>
          ))
        )}
      </Box>
      <TagPane tags={prompt.tags} columns={size.columns} />
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
      <CommandPane buttons={buttons.buttons} selected={buttons.selected} error={state.error} columns={size.columns} />
    </Box>
  );
}
