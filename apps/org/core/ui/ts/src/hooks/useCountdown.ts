import { createContext } from 'svelte'
import { CountdownState } from './CountdownState.svelte.ts'

const [get, set, has] = createContext<CountdownState>()

export function useCountdown(idle: () => number, ends: () => number = () => 0): CountdownState {
  if (has()) {
    return get()
  }
  return set(new CountdownState(idle, ends))
}
