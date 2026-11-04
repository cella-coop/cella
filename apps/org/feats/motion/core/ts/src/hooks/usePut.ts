import { createContext } from 'svelte'
import { PutState } from './PutState.svelte.ts'

const [get, set, has] = createContext<PutState>()

export function usePut(): PutState {
  if (has()) {
    return get()
  }
  return set(new PutState())
}
