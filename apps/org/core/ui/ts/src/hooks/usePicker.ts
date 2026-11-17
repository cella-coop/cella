import { createContext } from 'svelte'
import { PickerState } from './PickerState.svelte.ts'

const [, set] = createContext<PickerState>()

// A picker's own state, new for each: none is ever inside another.
export function usePicker(initial: string | null): PickerState {
  return set(new PickerState(initial))
}
