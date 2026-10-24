import { createContext } from 'svelte'
import { DragState } from './DragState.svelte.ts'

const [get, set, has] = createContext<DragState>()

// The page's one drag: the nearest in context, or a new one for the
// component that asks first and the components below it.
export function useDrag(): DragState {
  if (has()) {
    return get()
  }
  return set(new DragState())
}
