import { createContext } from 'svelte'
import { DraftState } from './DraftState.svelte.ts'

const [get, set, has] = createContext<DraftState>()

export function useDraft(draft: () => string): DraftState {
  if (has()) {
    return get()
  }
  return set(new DraftState(draft))
}
