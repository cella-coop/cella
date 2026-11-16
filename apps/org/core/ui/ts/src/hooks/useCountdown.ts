import { createContext } from 'svelte'
import { CountdownState } from './CountdownState.svelte.ts'

const [get, set, has] = createContext<CountdownState>()

export function useCountdown(seconds: () => number): CountdownState {
  if (has()) {
    return get()
  }
  return set(new CountdownState(seconds))
}
