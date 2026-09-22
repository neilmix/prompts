import { Box, Text, useApp, useInput } from 'ink';
import * as path from 'node:path';
import { useReducer, useState } from 'react';
import { copyToClipboard } from '../clipboard.js';
import { fullOrder, visibleIds } from '../model/select.js';
import { initialState, reduce } from '../model/state.js';
import type { AppSettings, Message } from '../model/types.js';
import type { Fs } from '../store/fs.js';
import { loadStore, type Store } from '../store/open.js';
import { createPrompt, deletePrompt, ensureText, readText, savePrompt } from '../store/prompts.js';
import { resolveEditor, saveSettings } from '../store/settings.js';
import { moveInOrder, saveSort } from '../store/sort.js';
import { Confirm, CONFIRM_HEIGHT } from './controls/Confirm.js';
import type { Actions, Overlay } from './context.js';
import { useSize, type Size } from './hooks/useSize.js';
import { ListView } from './ListView.js';
import { FilterModal } from './modals/FilterModal.js';
import { NewModal } from './modals/NewModal.js';
import { OpenModal } from './modals/OpenModal.js';
import { SettingsModal } from './modals/SettingsModal.js';
import { TagModal } from './modals/TagModal.js';

export const MIN_COLUMNS = 40;
export const MIN_ROWS = 10;

/** Value passed to Ink's exit(); the CLI prints the summary. */
export interface ExitResult {
  deleted: number;
}

export interface AppProps {
  fs: Fs;
  store: Store;
  env: Record<string, string | undefined>;
  /** Run the editor shell command on a file; resolves when it exits. */
  runEditor: (command: string, file: string) => Promise<void>;
  copy?: (text: string) => Promise<void>;
  /** Called instead of Ink's exit(); for tests. */
  onExit?: (result: ExitResult) => void;
  size?: Size;
  now?: () => Date;
}

export function App({ fs, store, env, runEditor, copy = copyToClipboard, onExit, size: sizeOverride, now = () => new Date() }: AppProps) {
  const app = useApp();
  const exit = onExit ?? app.exit;
  const size = useSize(sizeOverride);
  const [state, dispatch] = useReducer(reduce, store, initialState);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const { paths } = store;

  const fail = (e: unknown) => dispatch({ type: 'setMessage', message: { kind: 'error', text: (e as Error).message } });
  const guarded = <T,>(f: () => T, fallback: T): T => {
    try {
      return f();
    } catch (e) {
      fail(e);
      return fallback;
    }
  };

  const quit = (deleteDone: boolean) => {
    let deleted = 0;
    if (deleteDone && state.done.size > 0) {
      guarded(() => {
        for (const id of state.done) deletePrompt(fs, paths, id);
        saveSort(fs, paths, fullOrder(state).filter((id) => !state.done.has(id)));
        deleted = state.done.size;
      }, undefined);
    }
    exit({ deleted } satisfies ExitResult);
  };

  const actions: Actions = {
    create: (title) =>
      guarded(() => {
        const prompt = createPrompt(fs, paths, title, new Set(state.prompts.keys()), now());
        const sort = [prompt.id, ...fullOrder(state)];
        saveSort(fs, paths, sort);
        dispatch({ type: 'upsertPrompt', prompt });
        dispatch({ type: 'setSort', sort });
        dispatch({ type: 'select', id: prompt.id });
        return prompt.id;
      }, null),
    rename: (id, title) =>
      guarded(() => {
        const prompt = { ...state.prompts.get(id)!, title: title.trim() };
        savePrompt(fs, paths, prompt);
        dispatch({ type: 'upsertPrompt', prompt });
      }, undefined),
    setTags: (id, tags) =>
      guarded(() => {
        const prompt = { ...state.prompts.get(id)!, tags };
        savePrompt(fs, paths, prompt);
        dispatch({ type: 'upsertPrompt', prompt });
      }, undefined),
    move: (dir) =>
      guarded(() => {
        if (state.selectedId === null) return;
        const sort = moveInOrder(fullOrder(state), visibleIds(state), state.selectedId, dir);
        if (!sort) return;
        saveSort(fs, paths, sort);
        dispatch({ type: 'setSort', sort });
      }, undefined),
    saveSettings: (settings: AppSettings) =>
      guarded(() => {
        saveSettings(fs, paths, settings);
        dispatch({ type: 'setSettings', settings });
      }, undefined),
    readText: (id) => guarded(() => readText(fs, paths, id), ''),
    textPath: (id) => path.relative(path.dirname(paths.root), paths.textFile(id)),
    edit: async (id, suspend) => {
      try {
        const file = ensureText(fs, paths, id);
        await suspend(() => runEditor(resolveEditor(state.settings, env), file));
        // Force a redraw: renders during the suspension are discarded.
        dispatch({ type: 'setMessage', message: null });
      } catch (e) {
        fail(e);
      }
    },
    copy: async (id) => {
      try {
        const text = readText(fs, paths, id);
        // A prompt with no text yet: the title is the useful thing to copy.
        await copy(text.trim() === '' ? state.prompts.get(id)!.title : text);
        dispatch({ type: 'setMessage', message: { kind: 'status', text: 'Copied' } satisfies Message });
      } catch (e) {
        fail(e);
      }
    },
    reload: () => {
      const r = loadStore(fs, paths);
      if (r.ok) dispatch({ type: 'replaceStore', store: r.store });
      else dispatch({ type: 'setMessage', message: { kind: 'error', text: `reload failed: ${r.errors[0]}` } });
    },
    requestQuit: () => {
      if (state.done.size === 0) quit(false);
      else setConfirmingQuit(true);
    },
  };

  const tooSmall = size.rows < MIN_ROWS || size.columns < MIN_COLUMNS;

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (confirmingQuit) return;
      if (tooSmall) quit(false);
      else actions.requestQuit();
      return;
    }
    if (tooSmall && input === 'q') quit(false);
    else if (state.message !== null) dispatch({ type: 'setMessage', message: null });
  });

  if (tooSmall) {
    return (
      <Box height={size.rows} width={size.columns} alignItems="center" justifyContent="center">
        <Text color="red">terminal too small</Text>
      </Box>
    );
  }

  const overlay: Overlay | null = confirmingQuit
    ? {
        height: CONFIRM_HEIGHT,
        node: (
          <Confirm
            columns={size.columns}
            question={`Delete ${state.done.size} done prompt${state.done.size === 1 ? '' : 's'}?`}
            onYes={() => quit(true)}
            onNo={() => setConfirmingQuit(false)}
          />
        ),
      }
    : null;

  const props = { state, dispatch, actions, size, overlay };
  switch (state.modal?.kind) {
    case 'new':
      return <NewModal {...props} />;
    case 'open':
      return <OpenModal {...props} id={state.modal.id} />;
    case 'tag':
      return <TagModal {...props} id={state.modal.id} from={state.modal.from} />;
    case 'filter':
      return <FilterModal {...props} />;
    case 'settings':
      return <SettingsModal {...props} />;
    default:
      return <ListView {...props} />;
  }
}
