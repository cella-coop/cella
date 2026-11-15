import { createContext } from 'svelte'
import type { Decider, Setting } from '../models/settings.ts'
import type { Answer } from '../post.ts'
import { SettingsState } from './SettingsState.svelte.ts'

const [get, set] = createContext<SettingsState>()

// A settings form's state: a form hands its settings, the circle that
// decides its motions and how a field's write is posted, and makes it;
// each setting and the dialog below it read the nearest one.
export function useSettings(
  settings?: () => Setting[],
  decider?: () => Decider | null,
  post?: (write: string, fields: [string, string][]) => Promise<Answer>,
): SettingsState {
  if (settings && post) {
    return set(new SettingsState(settings, decider ?? (() => null), post))
  }
  return get()
}
