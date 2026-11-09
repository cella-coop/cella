import { createContext } from 'svelte'
import { WriteState } from './WriteState.svelte.ts'

const [get, set, has] = createContext<WriteState>()

// The writes of the page and the last outcome: the root layout makes it,
// the route names how its page writes (`serve`), and every form and drop
// below posts through it.
export function useWrites(): WriteState {
  if (has()) {
    return get()
  }
  return set(new WriteState())
}
