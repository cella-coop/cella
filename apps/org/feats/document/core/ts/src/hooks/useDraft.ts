import { createContext } from 'svelte'
import type { Page } from '../models/document.ts'
import { DraftState } from './DraftState.svelte.ts'

const [get, set, has] = createContext<DraftState>()

export function useDraft(page: () => Page): DraftState {
  if (has()) {
    return get()
  }
  return set(new DraftState(page))
}
