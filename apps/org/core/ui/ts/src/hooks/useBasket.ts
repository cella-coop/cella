import { createContext } from 'svelte'
import { BasketState } from './BasketState.svelte.ts'

const [get, set, has] = createContext<BasketState>()

// The changes to propose: the settings route makes them, naming the page
// open and what to do as a change is gathered; a settings form below it
// reads them, and one with none above it, as a record's page, offers each
// motion in its own dialog instead.
export function useBasket(here: () => { page: string; id: string }, gathered?: () => void): BasketState
export function useBasket(): BasketState | null
export function useBasket(here?: () => { page: string; id: string }, gathered?: () => void): BasketState | null {
  if (here) {
    return set(new BasketState(here, gathered))
  }
  return has() ? get() : null
}
