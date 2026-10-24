import { createContext } from 'svelte'
import { StanceState } from './StanceState.svelte.ts'

const [get, set, has] = createContext<StanceState>()

export function useStance(current: () => string): StanceState {
  if (has()) {
    return get()
  }
  return set(new StanceState(current))
}
