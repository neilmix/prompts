import type { Prompt } from '../store/prompts.js';
import type { AppSettings, SettingKey } from '../store/settings.js';

export type { Prompt, AppSettings, SettingKey };

export type Modal =
  | { kind: 'new' }
  | { kind: 'open'; id: string }
  /** `from` is the view Back returns to. */
  | { kind: 'tag'; id: string; from: 'list' | 'open' }
  | { kind: 'settings' }
  | { kind: 'archive' }
  /** An archived prompt's text, read-only. Back returns to the archive view. */
  | { kind: 'archived'; id: string };

export interface Message {
  kind: 'error' | 'status';
  text: string;
}

export interface State {
  prompts: Map<string, Prompt>;
  archived: Map<string, Prompt>;
  sort: string[];
  settings: AppSettings;
  selectedId: string | null;
  /** List view search (see searchTokens). Empty means none. */
  search: string;
  /** Ids marked for archiving on Quit. */
  archiving: Set<string>;
  modal: Modal | null;
  message: Message | null;
}
