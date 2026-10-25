import { createContext } from 'svelte'
import type { Week } from '../models/week.ts'
import { WeekState } from './WeekState.svelte.ts'

const [get, set, has] = createContext<WeekState>()

export function useWeek(weeks: () => Week[]): WeekState {
  if (has()) {
    return get()
  }
  return set(new WeekState(weeks))
}
