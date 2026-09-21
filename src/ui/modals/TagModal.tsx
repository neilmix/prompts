import { Box } from 'ink';
import { useState } from 'react';
import { allTags, canonicalTag, completeTag, tagEq, validateTag } from '../../model/select.js';
import { ScrollList } from '../controls/ScrollList.js';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { useButtons } from '../hooks/useButtons.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { CommandPane, COMMAND_PANE_HEIGHT } from '../panes/CommandPane.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';

export function TagModal({ state, dispatch, actions, size, id }: ViewProps & { id: string }) {
  const prompt = state.prompts.get(id)!;
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState(false);
  const existing = allTags(state.prompts.values());
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - COMMAND_PANE_HEIGHT - (adding ? TEXT_INPUT_HEIGHT : 0));
  const clampSel = Math.min(selected, Math.max(0, prompt.tags.length - 1));

  const back = () => dispatch({ type: 'closeModal' });
  const buttons = useButtons([
    { label: 'Add', shortcut: 'a', onActivate: () => setAdding(true) },
    {
      label: 'Remove',
      shortcut: 'r',
      onActivate: () => {
        if (prompt.tags.length === 0) return;
        actions.setTags(id, prompt.tags.filter((_, i) => i !== clampSel));
      },
    },
    { label: 'Back', shortcut: 'b', onActivate: back },
  ]);

  useKeyActions((a) => {
    if (buttons.handle(a)) return;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected(Math.max(0, clampSel - 1)); break;
      case 'down': setSelected(Math.min(prompt.tags.length - 1, clampSel + 1)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(Math.max(0, prompt.tags.length - 1)); break;
    }
  }, !adding);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title={prompt.title} />
      <ScrollList items={prompt.tags} selected={clampSel} height={listHeight} width={size.columns} gap={0} emptyText="no tags" />
      {adding && (
        <TextInput
          columns={size.columns}
          label="Tag"
          complete={(v) => completeTag(v, existing)}
          onSubmit={(v) => {
            const problem = validateTag(v);
            if (problem) {
              dispatch({ type: 'setError', error: problem });
              setAdding(false);
              return;
            }
            const tag = canonicalTag(v.trim(), existing);
            if (!prompt.tags.some((t) => tagEq(t, tag))) actions.setTags(id, [...prompt.tags, tag]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <CommandPane buttons={buttons.buttons} selected={buttons.selected} error={state.error} columns={size.columns} />
    </Box>
  );
}
