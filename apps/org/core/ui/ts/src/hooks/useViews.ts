import { createContext } from 'svelte'
import { ViewsState } from './ViewsState.svelte.ts'

const [get, set, has] = createContext<ViewsState>()

// The viewer's views of a collection: the ones in context, or new ones
// over the collection the first caller names, counted again whenever
// `rows` changes.
export function useViews(collection: () => string, rows?: () => unknown): ViewsState {
  if (has()) {
    return get()
  }
  return set(new ViewsState(collection, rows))
}
