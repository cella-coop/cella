import { createContext } from 'svelte'
import type { Entry } from '../models/menu.ts'
import { MenuState } from './MenuState.svelte.ts'

const [, set] = createContext<MenuState>()

// A context menu's own state, new for each target, a chip's or a row's:
// a menu is never inside another's state, its submenus being its levels.
export function useMenu(items: () => Entry[]): MenuState {
  return set(new MenuState(items))
}
