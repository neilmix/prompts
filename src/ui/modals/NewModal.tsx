import { Box } from 'ink';
import { TextInput } from '../controls/TextInput.js';
import type { ViewProps } from '../context.js';
import { TitleBar } from '../panes/TitleBar.js';

export function NewModal({ dispatch, actions, size }: ViewProps) {
  return (
    <Box flexDirection="column" height={size.rows} width={size.columns}>
      <TitleBar title="New prompt" />
      <Box flexGrow={1} />
      <TextInput
        columns={size.columns}
        label="Title"
        onSubmit={(v) => {
          if (v.trim() === '') return;
          actions.create(v);
          dispatch({ type: 'closeModal' });
        }}
        onCancel={() => dispatch({ type: 'closeModal' })}
      />
    </Box>
  );
}
