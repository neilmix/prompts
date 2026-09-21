import { Box } from 'ink';
import { useRef, useState } from 'react';
import { allTags, canonicalTag, completeTag, tagEq, validateTag } from '../../model/select.js';
import { ListBody, GUTTER } from '../controls/ListBody.js';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { useCommands } from '../hooks/useCommands.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { vimAction } from '../keys.js';
import { CommandPane, commandPaneHeight } from '../panes/CommandPane.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';
import { listViewport } from '../text.js';

export function TagModal({ state, dispatch, actions, size, overlay, id }: ViewProps & { id: string }) {
  const prompt = state.prompts.get(id)!;
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const topRef = useRef(0);
  const existing = allTags(state.prompts.values());
  const bottom = overlay ? overlay.height : adding !== null ? TEXT_INPUT_HEIGHT : 0;
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - commandPaneHeight(state.message) - bottom);
  const sel = Math.min(selected, Math.max(0, prompt.tags.length - 1));
  const view = listViewport(prompt.tags, sel, listHeight, size.columns - GUTTER, topRef.current);
  topRef.current = view.top;

  const back = () => dispatch({ type: 'closeModal' });
  const remove = () => {
    if (prompt.tags.length === 0) return;
    actions.setTags(id, prompt.tags.filter((_, i) => i !== sel));
  };
  const commands = useCommands(
    [
      { label: 'Add', shortcut: 'a', onActivate: () => setAdding('') },
      { label: 'Remove', shortcut: 'r', onActivate: remove },
      { label: 'Back', shortcut: 'b', onActivate: back },
    ],
    () => setAdding(''),
  );

  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected(Math.max(0, sel - 1)); break;
      case 'down': setSelected(Math.min(prompt.tags.length - 1, sel + 1)); break;
      case 'pageUp': setSelected(Math.max(0, sel - listHeight)); break;
      case 'pageDown': setSelected(Math.min(prompt.tags.length - 1, sel + listHeight)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(Math.max(0, prompt.tags.length - 1)); break;
      case 'delete': case 'backspace': remove(); break;
      case 'char': if (a.text === 'q') back(); else setAdding(a.text); break;
      case 'mouse':
        if (a.button === 'wheelUp') setSelected(Math.max(0, sel - 1));
        else if (a.button === 'wheelDown') setSelected(Math.min(prompt.tags.length - 1, sel + 1));
        break;
    }
  }, adding === null && overlay === null);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title={`Tags › ${prompt.title}`} right={id} columns={size.columns} />
      <ListBody rows={view.rows} selected={sel} focused={commands.focus === 0} height={listHeight} emptyText="no tags · ^A to add one" />
      {adding !== null && (
        <TextInput
          key={adding}
          columns={size.columns}
          label="Tag"
          initial={adding}
          complete={(v) => completeTag(v, existing)}
          onSubmit={(v) => {
            const problem = validateTag(v);
            if (problem) {
              dispatch({ type: 'setMessage', message: { kind: 'error', text: problem } });
              setAdding(null);
              return;
            }
            const tag = canonicalTag(v.trim(), existing);
            if (!prompt.tags.some((t) => tagEq(t, tag))) actions.setTags(id, [...prompt.tags, tag]);
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      )}
      {overlay?.node}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} />
    </Box>
  );
}
