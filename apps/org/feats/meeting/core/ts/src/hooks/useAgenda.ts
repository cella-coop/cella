import { createContext } from 'svelte'
import type { Item } from '../models/meeting.ts'
import { AgendaState } from './AgendaState.svelte.ts'

const [get, set, has] = createContext<AgendaState>()

export function useAgenda(items: () => Item[], path: () => string): AgendaState {
  if (has()) {
    return get()
  }
  return set(new AgendaState(items, path))
}
