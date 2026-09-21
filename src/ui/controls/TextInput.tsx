import { Box, Text } from 'ink';
import { useState } from 'react';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { Separator } from '../panes/Separator.js';

export const TEXT_INPUT_HEIGHT = 2;
const HINT = 'Tab completes';

export interface TextInputProps {
  label: string;
  initial?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  /** Called on every change; used for live search. */
  onChange?: (value: string) => void;
  /** Return a suggested full value for the current text, or null. */
  complete?: (value: string) => string | null;
  columns: number;
}

/** Single-line editor. Takes over input while mounted, except ^C. */
export function TextInput({ label, initial = '', onSubmit, onCancel, onChange, complete, columns }: TextInputProps) {
  const [value, setValueRaw] = useState(initial);
  const [cursor, setCursor] = useState(initial.length);
  const setValue = (v: string) => {
    setValueRaw(v);
    onChange?.(v);
  };
  const suggestion = complete?.(value) ?? null;
  const suffix =
    suggestion !== null && cursor === value.length && suggestion.length > value.length
      ? suggestion.slice(value.length)
      : '';

  useKeyActions((a) => {
    switch (a.type) {
      case 'char':
        setValue(value.slice(0, cursor) + a.text + value.slice(cursor));
        setCursor(cursor + a.text.length);
        break;
      case 'space':
        setValue(value.slice(0, cursor) + ' ' + value.slice(cursor));
        setCursor(cursor + 1);
        break;
      case 'backspace':
        if (cursor > 0) {
          setValue(value.slice(0, cursor - 1) + value.slice(cursor));
          setCursor(cursor - 1);
        }
        break;
      case 'delete':
        setValue(value.slice(0, cursor) + value.slice(cursor + 1));
        break;
      case 'left':
        setCursor(Math.max(0, cursor - 1));
        break;
      case 'right':
      case 'tab':
        if (suffix !== '') {
          setValue(value + suffix);
          setCursor(value.length + suffix.length);
        } else if (a.type === 'right') setCursor(Math.min(value.length, cursor + 1));
        break;
      case 'home':
        setCursor(0);
        break;
      case 'end':
        setCursor(value.length);
        break;
      case 'enter':
        onSubmit(value);
        break;
      case 'escape':
        onCancel();
        break;
    }
  });

  const before = value.slice(0, cursor);
  const at = cursor < value.length ? value[cursor]! : suffix === '' ? ' ' : suffix[0]!;
  const after = cursor < value.length ? value.slice(cursor + 1) : '';
  const rest = cursor < value.length ? '' : suffix.slice(1);
  const used = label.length + 2 + value.length + Math.max(1, suffix.length);
  const hintPad = Math.max(1, columns - used - HINT.length);
  return (
    <Box flexDirection="column" height={TEXT_INPUT_HEIGHT} width={columns} overflow="hidden">
      <Separator columns={columns} />
      <Box flexWrap="nowrap">
        <Text bold>{label}: </Text>
        <Text>{before}</Text>
        <Text inverse dimColor={cursor >= value.length && suffix !== ''}>
          {at}
        </Text>
        <Text>{after}</Text>
        <Text dimColor>{rest}</Text>
        {suffix !== '' && (
          <Text dimColor>
            {' '.repeat(hintPad)}
            {HINT}
          </Text>
        )}
      </Box>
    </Box>
  );
}
