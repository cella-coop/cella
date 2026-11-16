import { ArrangeState } from './ArrangeState.svelte.ts'

// An arrangement's state, its own: each arrangement keeps the accordions
// it just made.
export const useArrange = (): ArrangeState => new ArrangeState()
