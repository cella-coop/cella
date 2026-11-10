import { QuoteState } from './QuoteState.svelte.ts'

// The quote a comment box offers, from the draft's selection.
export function useQuote(): QuoteState {
  return new QuoteState()
}
