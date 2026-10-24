import { createContext } from 'svelte'
import type { Column } from '../models/view.ts'
import { CollectionState } from './CollectionState.svelte.ts'

const [get, set, has] = createContext<CollectionState>()

// The collection's state: the one in context, or a new one over the rows
// and columns the first caller hands it.
export function useCollection(rows: () => any[], columns: () => Column[]): CollectionState {
  if (has()) {
    return get()
  }
  return set(new CollectionState(rows, columns))
}
