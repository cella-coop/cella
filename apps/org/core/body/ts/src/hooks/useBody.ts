import { createContext } from 'svelte'
import type { Bodied } from '../models/index.ts'
import { BodyState } from './BodyState.svelte.ts'

const [get, set, has] = createContext<BodyState>()

// The one `BodyState` for the body this page mounts, by its collection:
// the first call each render makes it, over the page's own data, and
// holds it for the save it starts.
export function useBody(collection: () => string, page: () => Bodied & { id: string }): BodyState {
  if (has()) {
    return get()
  }
  return set(new BodyState(collection, page))
}
