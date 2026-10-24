import { createContext } from 'svelte'
import { ViewsState } from './ViewsState.svelte.ts'

const [get, set, has] = createContext<ViewsState>()

export function useViews(collection: () => string): ViewsState {
  if (has()) {
    return get()
  }
  return set(new ViewsState(collection))
}
