import { Box } from 'ink';
import { useState } from 'react';
import { SETTING_KEYS, type SettingKey } from '../../store/settings.js';
import { ListBody, GUTTER } from '../controls/ListBody.js';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { useCommands } from '../hooks/useCommands.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { vimAction } from '../keys.js';
import { CommandPane, commandPaneHeight } from '../panes/CommandPane.js';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.js';
import { listViewport } from '../text.js';

export function SettingsModal({ state, dispatch, actions, size, overlay }: ViewProps) {
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<SettingKey | null>(null);
  const bottom = overlay ? overlay.height : editing ? TEXT_INPUT_HEIGHT : 0;
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - commandPaneHeight(state.message) - bottom);
  const items = SETTING_KEYS.map((k) => `${k}: ${state.settings[k] ?? ''}`);
  const view = listViewport(items, selected, listHeight, size.columns - GUTTER, 0);

  const back = () => dispatch({ type: 'closeModal' });
  const edit = () => setEditing(SETTING_KEYS[selected] ?? null);
  const commands = useCommands(
    [
      { label: 'Edit', shortcut: 'e', onActivate: edit },
      { label: 'Back', shortcut: 'b', onActivate: back },
    ],
    edit,
  );

  useKeyActions((raw) => {
    if (commands.handle(raw)) return;
    const a = vimAction(raw) ?? raw;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected((s) => Math.max(0, s - 1)); break;
      case 'down': setSelected((s) => Math.min(SETTING_KEYS.length - 1, s + 1)); break;
      case 'top': case 'home': setSelected(0); break;
      case 'bottom': case 'end': setSelected(SETTING_KEYS.length - 1); break;
      case 'char': if (a.text === 'q') back(); break;
    }
  }, editing === null && overlay === null);

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="Settings" columns={size.columns} />
      <ListBody rows={view.rows} selected={selected} focused={commands.focus === 0} height={listHeight} emptyText="no settings" />
      {editing !== null && (
        <TextInput
          columns={size.columns}
          label={editing}
          initial={state.settings[editing] ?? ''}
          onSubmit={(v) => {
            actions.saveSettings({ ...state.settings, [editing]: v.trim() });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {overlay?.node}
      <CommandPane buttons={commands.buttons} focus={commands.focus} message={state.message} columns={size.columns} />
    </Box>
  );
}
