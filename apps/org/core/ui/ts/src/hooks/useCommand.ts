import { createContext } from 'svelte'
import type { Jump } from '../models/view.ts'
import { CommandState } from './CommandState.svelte.ts'

const [get, set, has] = createContext<CommandState>()

export function useCommand(collections: () => Jump[], source: () => string): CommandState {
  if (has()) {
    return get()
  }
  return set(new CommandState(collections, source))
}
