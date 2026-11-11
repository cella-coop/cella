import { createContext } from 'svelte'
import { RowState } from './RowState.ts'

const [get, set, has] = createContext<RowState>()

// The keyboard's row kept across history: the one the page put in
// context, or a new one.
export function useRow(): RowState {
  if (has()) {
    return get()
  }
  return set(new RowState())
}
