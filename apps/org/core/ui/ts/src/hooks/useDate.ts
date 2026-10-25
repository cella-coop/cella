import { createContext } from 'svelte'
import { DateState } from './DateState.svelte.ts'

const [get, set, has] = createContext<DateState>()

export function useDate(value: () => string | number, put: (iso: string) => void): DateState {
  if (has()) {
    return get()
  }
  return set(new DateState(value, put))
}
