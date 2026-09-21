import { useApp, useInput } from 'ink';
import { useReducer } from 'react';
import { fullOrder, visibleIds } from '../model/select.js';
import { initialState, reduce } from '../model/state.js';
import type { AppSettings } from '../model/types.js';
import type { Fs } from '../store/fs.js';
import type { Store } from '../store/open.js';
import { createPrompt, deletePrompt, ensureText, readText, savePrompt } from '../store/prompts.js';
import { resolveEditor, saveSettings } from '../store/settings.js';
import { moveInOrder, saveSort } from '../store/sort.js';
import type { Actions } from './context.js';
import { useSize, type Size } from './hooks/useSize.js';
import { ListView } from './ListView.jsx';
import { FilterModal } from './modals/FilterModal.jsx';
import { NewModal } from './modals/NewModal.jsx';
import { OpenModal } from './modals/OpenModal.jsx';
import { SettingsModal } from './modals/SettingsModal.jsx';
import { TagModal } from './modals/TagModal.jsx';

export interface AppProps {
  fs: Fs;
  store: Store;
  env: Record<string, string | undefined>;
  /** Run the editor argv on a file; resolves when it exits. */
  runEditor: (argv: string[], file: string) => Promise<void>;
  size?: Size;
  now?: () => Date;
}

export function App({ fs, store, env, runEditor, size: sizeOverride, now = () => new Date() }: AppProps) {
  const { exit } = useApp();
  const size = useSize(sizeOverride);
  const [state, dispatch] = useReducer(reduce, store, initialState);
  const { paths } = store;

  useInput(() => dispatch({ type: 'setError', error: null }), { isActive: state.error !== null });

  const guarded = (f: () => void) => {
    try {
      f();
    } catch (e) {
      dispatch({ type: 'setError', error: (e as Error).message });
    }
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
      }),
    rename: (id, title) =>
      guarded(() => {
        const prompt = { ...state.prompts.get(id)!, title: title.trim() };
        savePrompt(fs, paths, prompt);
        dispatch({ type: 'upsertPrompt', prompt });
      }),
    setTags: (id, tags) =>
      guarded(() => {
        const prompt = { ...state.prompts.get(id)!, tags };
        savePrompt(fs, paths, prompt);
        dispatch({ type: 'upsertPrompt', prompt });
      }),
    move: (dir) =>
      guarded(() => {
        if (state.selectedId === null) return;
        const sort = moveInOrder(fullOrder(state), visibleIds(state), state.selectedId, dir);
        if (!sort) return;
        saveSort(fs, paths, sort);
        dispatch({ type: 'setSort', sort });
      }),
    saveSettings: (settings: AppSettings) =>
      guarded(() => {
        saveSettings(fs, paths, settings);
        dispatch({ type: 'setSettings', settings });
      }),
    readText: (id) => {
      try {
        return readText(fs, paths, id);
      } catch (e) {
        dispatch({ type: 'setError', error: (e as Error).message });
        return '';
      }
    },
    edit: async (id, suspend) => {
      try {
        const file = ensureText(fs, paths, id);
        const argv = resolveEditor(state.settings, env);
        await suspend(() => runEditor(argv, file));
      } catch (e) {
        dispatch({ type: 'setError', error: (e as Error).message });
      }
    },
    leave: () =>
      guarded(() => {
        const ids = [...state.completed];
        for (const id of ids) deletePrompt(fs, paths, id);
        if (ids.length > 0) saveSort(fs, paths, fullOrder(state).filter((id) => !state.completed.has(id)));
        dispatch({ type: 'removePrompts', ids });
        exit();
      }),
  };

  const props = { state, dispatch, actions, size };
  switch (state.modal?.kind) {
    case 'new':
      return <NewModal {...props} />;
    case 'open':
      return <OpenModal {...props} id={state.modal.id} />;
    case 'tag':
      return <TagModal {...props} id={state.modal.id} />;
    case 'filter':
      return <FilterModal {...props} />;
    case 'settings':
      return <SettingsModal {...props} />;
    default:
      return <ListView {...props} />;
  }
}
