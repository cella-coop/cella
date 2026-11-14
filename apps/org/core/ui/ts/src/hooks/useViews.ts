import { createContext } from 'svelte'
import type { Custom } from '../models/query.ts'
import { ViewsState } from './ViewsState.svelte.ts'

const [get, set, has] = createContext<ViewsState>()

// The viewer's views of a collection: the ones in context, or new ones
// over the collection the first caller names, counted again whenever
// `rows` changes, each at the address `href` gives it.
export function useViews(collection: () => string, rows?: () => unknown, href?: (view: Custom) => string): ViewsState {
  if (has()) {
    return get()
  }
  return set(new ViewsState(collection, rows, href))
}
