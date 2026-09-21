import type { Prompt } from '../store/prompts.js';
import type { AppSettings, SettingKey } from '../store/settings.js';

export type { Prompt, AppSettings, SettingKey };

export type Modal =
  | { kind: 'new' }
  | { kind: 'open'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'filter' }
  | { kind: 'settings' };

export interface State {
  prompts: Map<string, Prompt>;
  sort: string[];
  settings: AppSettings;
  selectedId: string | null;
  /** Checked filter tags, in stored spelling. */
  filter: string[];
  completed: Set<string>;
  modal: Modal | null;
  error: string | null;
}
