import { createContext } from 'svelte'
import type { Option } from '../models/select.ts'
import { SelectState } from './SelectState.svelte.ts'

const [, set] = createContext<SelectState>()

// A select's own state, new for each select: none is ever inside another.
export function useSelect(options: () => Option[], value: () => string): SelectState {
  return set(new SelectState(options, value))
}
