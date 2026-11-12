import { createContext } from 'svelte'
import { useWrites } from '@cella/org-ui'
import type { Item } from '../models/meeting.ts'
import { AgendaState } from './AgendaState.svelte.ts'

const [get, set, has] = createContext<AgendaState>()

// A meeting's agenda, its writes sent for the meeting by the page's.
export function useAgenda(items: () => Item[], meeting: () => string): AgendaState {
  if (has()) {
    return get()
  }
  return set(new AgendaState(items, meeting, useWrites()))
}
