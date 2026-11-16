import { createContext } from 'svelte'
import { TimeState } from './TimeState.svelte.ts'

const [, set] = createContext<TimeState>()

// A time field's own state, new for each field: none is ever inside another.
export function useTime(value: () => string | number, put: (time: string) => void, step?: number): TimeState {
  return set(new TimeState(value, put, step))
}
