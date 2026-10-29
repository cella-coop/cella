import { createContext } from 'svelte'
import { RecordState } from './RecordState.svelte.ts'

const [get, set, has] = createContext<RecordState>()

export function useRecord(): RecordState {
  if (has()) {
    return get()
  }
  return set(new RecordState())
}
