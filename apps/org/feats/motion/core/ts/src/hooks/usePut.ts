import { createContext } from 'svelte'
import type { Held } from '../models/circles.ts'
import { PutState } from './PutState.svelte.ts'

const [get, set, has] = createContext<PutState>()

// The Propose form's state, shared by the blocks of one form; a mandate's
// page passes the mandate it changes, which fills the form.
export function usePut(changing?: () => Held | undefined): PutState {
  if (has()) {
    return get()
  }
  return set(new PutState(changing?.()))
}
