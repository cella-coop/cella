import { RepeatState } from './RepeatState.svelte.ts'

// A fresh `RepeatState` for the form that asks, its rows starting as
// given, each a fresh `make()` once Add is pressed.
export function useRepeat<T>(make: () => T, rows: T[] = []): RepeatState<T> {
  return new RepeatState(make, rows)
}
