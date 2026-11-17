import { createContext } from 'svelte'
import { PairState } from './PairState.svelte.ts'

const [get, set, has] = createContext<PairState>()

export function usePair(initial: () => string): PairState {
  if (has()) {
    return get()
  }
  return set(new PairState(initial))
}
