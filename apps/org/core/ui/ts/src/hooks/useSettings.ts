import { createContext } from 'svelte'
import type { Decider, Setting } from '../models/settings.ts'
import { SettingsState } from './SettingsState.svelte.ts'
import { useBasket } from './useBasket.ts'
import { useWrites } from './useWrites.ts'

const [get, set] = createContext<SettingsState>()

// A settings form's state: a form hands its settings and the circle that
// decides its motions and makes it, posting through the page's writes;
// each setting and the dialog below it read the nearest one.
export function useSettings(settings?: () => Setting[], decider?: () => Decider | null, where?: () => string | undefined): SettingsState {
  if (settings) {
    return set(new SettingsState(settings, decider ?? (() => null), useWrites(), useBasket(), where))
  }
  return get()
}
