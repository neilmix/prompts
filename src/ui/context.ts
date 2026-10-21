import type { Dispatch } from 'react';
import type { SuspendTerminal } from 'ink';
import type { Action } from '../model/state.js';
import type { AppSettings, Prompt, State } from '../model/types.js';
import type { Size } from './hooks/useSize.js';

/** Side-effecting operations the UI can invoke. Each persists, then dispatches. */
export interface Actions {
  /** Returns the new id, or null on failure. */
  create(title: string): string | null;
  rename(id: string, title: string): void;
  setTags(id: string, tags: string[]): void;
  /** Move the selected prompt `by` steps in the displayed order (negative = up). */
  move(by: number): void;
  saveSettings(settings: AppSettings): void;
  /** Path of a prompt's file relative to the directory holding `.prompts`. */
  itemPath(id: string): string;
  archivePath(id: string): string;
  edit(id: string, suspend: SuspendTerminal): Promise<void>;
  copy(id: string): Promise<void>;
  restore(id: string): void;
  reload(): void;
  /** Archive the marked prompts and exit. */
  quit(): void;
}

export interface ViewProps {
  state: State;
  dispatch: Dispatch<Action>;
  actions: Actions;
  size: Size;
}

export function selectedPrompt(state: State): Prompt | null {
  return state.selectedId === null ? null : (state.prompts.get(state.selectedId) ?? null);
}
