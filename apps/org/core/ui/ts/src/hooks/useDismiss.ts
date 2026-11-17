import { createContext } from 'svelte'
import { DismissState } from './DismissState.svelte.ts'

const [get, set, has] = createContext<DismissState>()

export function useDismiss(warn: () => boolean): DismissState {
  if (has()) {
    return get()
  }
  return set(new DismissState(warn))
}
