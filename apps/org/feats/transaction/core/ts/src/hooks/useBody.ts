import { createContext } from 'svelte'
import type { Bodied } from '../models/body.ts'
import { BodyState } from './BodyState.svelte.ts'

const [get, set, has] = createContext<BodyState>()

export function useBody(page: () => Bodied & { id: string }): BodyState {
  if (has()) {
    return get()
  }
  return set(new BodyState(page))
}
