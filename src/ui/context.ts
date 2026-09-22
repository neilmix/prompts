import type { Dispatch, ReactNode } from 'react';
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
  readText(id: string): string;
  textPath(id: string): string;
  edit(id: string, suspend: SuspendTerminal): Promise<void>;
  copy(id: string): Promise<void>;
  reload(): void;
  /** Ask to quit; confirms first when prompts are marked done. */
  requestQuit(): void;
}

/** An App-level pane (the quit confirmation) shown above the command pane. */
export interface Overlay {
  node: ReactNode;
  height: number;
}

export interface ViewProps {
  state: State;
  dispatch: Dispatch<Action>;
  actions: Actions;
  size: Size;
  overlay: Overlay | null;
}

export function selectedPrompt(state: State): Prompt | null {
  return state.selectedId === null ? null : (state.prompts.get(state.selectedId) ?? null);
}
