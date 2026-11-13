import { createContext } from 'svelte'
import type { Outcome } from '../models/outcome.ts'
import { ShellState, type Lens } from './ShellState.svelte.ts'

const [get, set, has] = createContext<ShellState>()

// The shell's state: the one the shell put in context, which pages and
// frames below it read; the shell itself hands the outcome, the drawer's
// opening state, the people's names, the lens and the circles the member
// reads the first time.
export function useShell(
  outcome: () => Outcome | null = () => null,
  drawer: () => boolean = () => true,
  names: () => Record<string, string> = () => ({}),
  lens: () => Lens | null = () => null,
  circles: () => Lens[] = () => [],
): ShellState {
  if (has()) {
    return get()
  }
  return set(new ShellState(outcome, drawer, names, lens, circles))
}
