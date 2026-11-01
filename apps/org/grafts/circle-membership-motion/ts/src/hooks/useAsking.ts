import { createContext } from 'svelte'
import { AskingState } from './AskingState.svelte.ts'

const [get, set, has] = createContext<AskingState>()

export function useAsking(first: () => string): AskingState {
  if (has()) {
    return get()
  }
  return set(new AskingState(first))
}
