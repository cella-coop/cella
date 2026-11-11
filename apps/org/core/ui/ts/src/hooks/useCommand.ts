import { createContext } from 'svelte'
import type { Jump } from '../models/view.ts'
import { CommandState, type Search } from './CommandState.svelte.ts'

const [get, set, has] = createContext<CommandState>()

export function useCommand(collections: () => Jump[], source: () => Search): CommandState {
  if (has()) {
    return get()
  }
  return set(new CommandState(collections, source))
}
