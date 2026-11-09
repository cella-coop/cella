import { createContext } from 'svelte'
import type { Decider, Setting } from '../models/settings.ts'
import { SettingsState } from './SettingsState.svelte.ts'

const [get, set] = createContext<SettingsState>()

// A settings form's state: a form hands its settings and the circle that
// decides its motions and makes it; each setting and the dialog below it
// read the nearest one.
export function useSettings(settings?: () => Setting[], decider?: () => Decider | null): SettingsState {
  if (settings) {
    return set(new SettingsState(settings, decider ?? (() => null)))
  }
  return get()
}
