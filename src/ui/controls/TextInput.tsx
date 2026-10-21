import { Box, Text } from 'ink';
import { useRef, useState } from 'react';
import { useKeyActions } from '../hooks/useKeyActions.js';
import { Separator } from '../panes/Separator.js';
import { entryOffset } from '../text.js';

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
  const offsetRef = useRef(0);
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

  // The entry's cells: the value, then the completion or a blank cell for
  // the cursor at the end. Scrolled horizontally to keep the cursor in view.
  const tail = suffix === '' ? ' ' : suffix;
  const cells = value + tail;
  const width = Math.max(3, columns - label.length - 2);
  const offset = entryOffset(cells.length, cursor, width, offsetRef.current);
  offsetRef.current = offset;
  const end = offset + width;
  const clipLeft = offset > 0;
  const clipRight = end < cells.length;
  const shown = (from: number, to: number) => cells.slice(Math.max(from, offset + (clipLeft ? 1 : 0)), Math.min(to, end - (clipRight ? 1 : 0)));
  const before = shown(0, cursor);
  const at = cells[cursor]!;
  const after = shown(cursor + 1, value.length);
  const rest = shown(Math.max(cursor + 1, value.length), cells.length);
  const used = label.length + 2 + Math.min(width, cells.length);
  const hintPad = Math.max(1, columns - used - HINT.length);
  return (
    <Box flexDirection="column" height={TEXT_INPUT_HEIGHT} width={columns} overflow="hidden">
      <Separator columns={columns} />
      <Box flexWrap="nowrap">
        <Text bold>{label}: </Text>
        {clipLeft && <Text dimColor>…</Text>}
        <Text>{before}</Text>
        <Text inverse dimColor={cursor >= value.length && suffix !== ''}>
          {at}
        </Text>
        <Text>{after}</Text>
        <Text dimColor>{rest}</Text>
        {clipRight && <Text dimColor>…</Text>}
        {suffix !== '' && !clipLeft && !clipRight && (
          <Text dimColor>
            {' '.repeat(hintPad)}
            {HINT}
          </Text>
        )}
      </Box>
    </Box>
  );
}
