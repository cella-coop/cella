import { createContext } from 'svelte'
import { CollectionState } from './CollectionState.svelte.ts'

const [get, set, has] = createContext<CollectionState>()

const nowhere = { filter: () => {}, more: () => {} }

// The collection's state: the one in context, or a new one over the rows,
// what is left of them and the address the first caller hands it.
export function useCollection(
  rows: () => any[] = () => [],
  left: () => number = () => 0,
  q: () => string = () => '',
  ask: { filter(q: string): void; more(): void } = nowhere,
): CollectionState {
  if (has()) {
    return get()
  }
  return set(new CollectionState(rows, left, q, ask))
}
