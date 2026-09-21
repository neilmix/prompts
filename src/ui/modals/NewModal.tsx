import { Box, useApp } from 'ink';
import { TextInput } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { TitleBar } from '../panes/TitleBar.js';

export function NewModal({ dispatch, actions, size }: ViewProps) {
  const { suspendTerminal } = useApp();
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="New prompt" columns={size.columns} />
      <Box flexGrow={1} />
      <TextInput
        columns={size.columns}
        label="Title"
        onSubmit={(v) => {
          if (v.trim() === '') return;
          const id = actions.create(v);
          dispatch({ type: 'closeModal' });
          if (id !== null) void actions.edit(id, suspendTerminal);
        }}
        onCancel={() => dispatch({ type: 'closeModal' })}
      />
    </Box>
  );
}
