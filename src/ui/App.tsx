import { Box, Text, useApp, useInput } from 'ink';
import * as path from 'node:path';
import { useReducer } from 'react';
import { copyToClipboard } from '../clipboard.js';
import { fullOrder, visibleIds } from '../model/select.js';
import { initialState, reduce } from '../model/state.js';
import type { AppSettings, Message } from '../model/types.js';
import * as ops from '../ops.js';
import type { Fs } from '../store/fs.js';
import { loadStore, type Store } from '../store/open.js';
import { readPrompt, updatePrompt } from '../store/prompts.js';
import { resolveEditor, saveSettings } from '../store/settings.js';
import type { Actions } from './context.js';
import { useSize, type Size } from './hooks/useSize.js';
import { ListView } from './ListView.js';
import { ArchiveModal } from './modals/ArchiveModal.js';
import { NewModal } from './modals/NewModal.js';
import { OpenModal } from './modals/OpenModal.js';
import { SettingsModal } from './modals/SettingsModal.js';
import { TagModal } from './modals/TagModal.js';

export const MIN_COLUMNS = 40;
export const MIN_ROWS = 10;

/** Value passed to Ink's exit(); the CLI prints the summary. */
export interface ExitResult {
  archived: number;
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
  const { paths } = store;

  const fail = (e: unknown) => dispatch({ type: 'setMessage', message: { kind: 'error', text: (e as Error).message } });
  const status = (text: string) => dispatch({ type: 'setMessage', message: { kind: 'status', text } satisfies Message });
  const guarded = <T,>(f: () => T, fallback: T): T => {
    try {
      return f();
    } catch (e) {
      fail(e);
      return fallback;
    }
  };
  const relative = (file: string) => path.relative(path.dirname(paths.root), file);

  const quit = () => {
    const marked = fullOrder(state).filter((id) => state.archiving.has(id));
    const r = ops.archive(fs, paths, state, marked);
    if (!r.error) return exit({ archived: r.archived.length } satisfies ExitResult);
    // Stay open to show the error; what did move is gone from the list.
    const archived = new Map(state.archived);
    for (const id of r.archived) archived.set(id, state.prompts.get(id)!);
    dispatch({ type: 'removePrompts', ids: r.archived });
    dispatch({ type: 'setArchived', archived });
    dispatch({ type: 'setSort', sort: r.sort });
    fail(r.error);
  };

  const actions: Actions = {
    create: (title) =>
      guarded(() => {
        const { prompt, sort } = ops.create(fs, paths, state, { title }, now());
        dispatch({ type: 'upsertPrompt', prompt });
        dispatch({ type: 'setSort', sort });
        dispatch({ type: 'select', id: prompt.id });
        return prompt.id;
      }, null),
    rename: (id, title) => guarded(() => dispatch({ type: 'upsertPrompt', prompt: ops.retitle(fs, paths, state, id, title) }), undefined),
    setTags: (id, tags) => guarded(() => dispatch({ type: 'upsertPrompt', prompt: ops.setTags(fs, paths, state, id, tags) }), undefined),
    move: (by) =>
      guarded(() => {
        if (state.selectedId === null) return;
        const sort = ops.moveBy(fs, paths, state, visibleIds(state), state.selectedId, by);
        if (sort) dispatch({ type: 'setSort', sort });
      }, undefined),
    saveSettings: (settings: AppSettings) =>
      guarded(() => {
        saveSettings(fs, paths, settings);
        dispatch({ type: 'setSettings', settings });
      }, undefined),
    itemPath: (id) => relative(paths.itemFile(id)),
    archivePath: (id) => relative(paths.archiveFile(id)),
    // The editor gets a temp copy of the text, so it cannot damage the
    // header. Read from disk: New calls this before its state update lands.
    edit: async (id, suspend) => {
      let dir: string | null = null;
      try {
        const prompt = readPrompt(fs, paths, id);
        dir = fs.mkdtemp('prompts-');
        const file = path.join(dir, `${id}.md`);
        fs.writeFile(file, prompt.text);
        await suspend(() => runEditor(resolveEditor(state.settings, env), file));
        const text = fs.readFile(file);
        if (text !== prompt.text) dispatch({ type: 'upsertPrompt', prompt: updatePrompt(fs, paths, prompt, { text }) });
        // Force a redraw: renders during the suspension are discarded.
        dispatch({ type: 'setMessage', message: null });
      } catch (e) {
        fail(e);
      } finally {
        if (dir !== null) {
          try {
            for (const name of fs.readdir(dir)) fs.unlink(path.join(dir, name));
            fs.rmdir(dir);
          } catch {
            // Leftover temp files are harmless.
          }
        }
      }
    },
    copy: async (id) => {
      try {
        const prompt = state.prompts.get(id) ?? state.archived.get(id)!;
        // A prompt with no text yet: the title is the useful thing to copy.
        await copy(prompt.text.trim() === '' ? prompt.title : prompt.text);
        status('Copied');
      } catch (e) {
        fail(e);
      }
    },
    restore: (id) =>
      guarded(() => {
        const { prompt, sort } = ops.restore(fs, paths, state, id);
        const archived = new Map(state.archived);
        archived.delete(id);
        dispatch({ type: 'setArchived', archived });
        dispatch({ type: 'upsertPrompt', prompt });
        dispatch({ type: 'setSort', sort });
        dispatch({ type: 'select', id });
        status(`Restored ${prompt.title}`);
      }, undefined),
    reload: () => {
      const r = loadStore(fs, paths);
      if (r.ok) dispatch({ type: 'replaceStore', store: r.store });
      else dispatch({ type: 'setMessage', message: { kind: 'error', text: `reload failed: ${r.errors[0]}` } });
    },
    quit,
  };

  const tooSmall = size.rows < MIN_ROWS || size.columns < MIN_COLUMNS;

  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || (tooSmall && input === 'q')) quit();
    else if (state.message !== null) dispatch({ type: 'setMessage', message: null });
  });

  if (tooSmall) {
    return (
      <Box height={size.rows} width={size.columns} alignItems="center" justifyContent="center">
        <Text color="red">terminal too small</Text>
      </Box>
    );
  }

  const props = { state, dispatch, actions, size };
  switch (state.modal?.kind) {
    case 'new':
      return <NewModal {...props} />;
    case 'open':
      return <OpenModal {...props} id={state.modal.id} />;
    case 'tag':
      return <TagModal {...props} id={state.modal.id} from={state.modal.from} />;
    case 'archive':
      return <ArchiveModal {...props} />;
    case 'archived':
      return <OpenModal {...props} id={state.modal.id} archived />;
    case 'settings':
      return <SettingsModal {...props} />;
    default:
      return <ListView {...props} />;
  }
}
