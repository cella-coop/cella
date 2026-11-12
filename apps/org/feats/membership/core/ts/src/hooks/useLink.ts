import { createContext } from 'svelte'
import { LinkState } from './LinkState.svelte.ts'

const [get, set, has] = createContext<LinkState>()

// The link a write of `op` makes on this page, as its outcome shows.
export function useLink(op: string): LinkState {
  if (has()) {
    return get()
  }
  return set(new LinkState(op))
}
