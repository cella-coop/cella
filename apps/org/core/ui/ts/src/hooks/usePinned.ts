import { createContext } from 'svelte'
import { PinnedState } from './PinnedState.svelte.ts'

const [get, set, has] = createContext<PinnedState>()

// The viewer's Pinned: the shell's, which it put in context, so a
// collection pinning a view shows it in the sidebar at once; or new ones
// where no shell is above.
export function usePinned(): PinnedState {
  if (has()) {
    return get()
  }
  return set(new PinnedState())
}
