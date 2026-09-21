import { Box } from 'ink';
import { useState } from 'react';
import { SETTING_KEYS, type SettingKey } from '../../store/settings.js';
import { ScrollList } from '../controls/ScrollList.jsx';
import { TextInput, TEXT_INPUT_HEIGHT } from '../controls/TextInput.jsx';
import type { ViewProps } from '../context.js';
import { useButtons } from '../hooks/useButtons.js';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { CommandPane, COMMAND_PANE_HEIGHT } from '../panes/CommandPane.jsx';
import { TitleBar, TITLE_BAR_HEIGHT } from '../panes/TitleBar.jsx';

export function SettingsModal({ state, dispatch, actions, size }: ViewProps) {
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<SettingKey | null>(null);
  const listHeight = Math.max(0, size.rows - TITLE_BAR_HEIGHT - COMMAND_PANE_HEIGHT - (editing ? TEXT_INPUT_HEIGHT : 0));

  const back = () => dispatch({ type: 'closeModal' });
  const buttons = useButtons([
    { label: 'Edit', shortcut: 'e', onActivate: () => setEditing(SETTING_KEYS[selected] ?? null) },
    { label: 'Back', shortcut: 'b', onActivate: back },
  ]);

  useKeyActions((a) => {
    if (buttons.handle(a)) return;
    switch (a.type) {
      case 'escape': back(); break;
      case 'up': setSelected((s) => Math.max(0, s - 1)); break;
      case 'down': setSelected((s) => Math.min(SETTING_KEYS.length - 1, s + 1)); break;
    }
  }, editing === null);

  const items = SETTING_KEYS.map((k) => `${k}: ${state.settings[k] ?? ''}`);
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="Settings" />
      <ScrollList items={items} selected={selected} height={listHeight} width={size.columns} gap={0} emptyText="no settings" />
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
      <CommandPane buttons={buttons.buttons} selected={buttons.selected} error={state.error} columns={size.columns} />
    </Box>
  );
}
