import { createContext } from 'svelte'
import type { Outcome } from '../models/outcome.ts'
import { ShellState } from './ShellState.svelte.ts'

const [get, set, has] = createContext<ShellState>()

export function useShell(outcome: () => Outcome | null): ShellState {
  if (has()) {
    return get()
  }
  return set(new ShellState(outcome))
}
