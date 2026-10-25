import { createContext } from 'svelte'
import type { Outcome } from '../models/outcome.ts'
import { ShellState } from './ShellState.svelte.ts'

const [get, set, has] = createContext<ShellState>()

// The shell's state: the one the shell put in context, which pages and
// frames below it read; the shell itself hands the outcome, the drawer's
// opening state and the people's names the first time.
export function useShell(
  outcome: () => Outcome | null = () => null,
  drawer: () => boolean = () => true,
  names: () => Record<string, string> = () => ({}),
): ShellState {
  if (has()) {
    return get()
  }
  return set(new ShellState(outcome, drawer, names))
}
