import { createContext } from 'svelte'
import { NotesState } from './NotesState.svelte.ts'

const [get, set, has] = createContext<NotesState>()

export function useNotes(): NotesState {
  if (has()) {
    return get()
  }
  return set(new NotesState())
}
