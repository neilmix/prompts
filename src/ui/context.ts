import type { Dispatch } from 'react';
import type { SuspendTerminal } from 'ink';
import type { Action } from '../model/state.js';
import type { AppSettings, Prompt, State } from '../model/types.js';
import type { Size } from './hooks/useSize.js';

/** Side-effecting operations the UI can invoke. Each persists, then dispatches. */
export interface Actions {
  create(title: string): void;
  rename(id: string, title: string): void;
  setTags(id: string, tags: string[]): void;
  move(dir: 'up' | 'down'): void;
  saveSettings(settings: AppSettings): void;
  readText(id: string): string;
  edit(id: string, suspend: SuspendTerminal): Promise<void>;
  leave(): void;
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
