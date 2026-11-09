import { createContext } from 'svelte'
import type { Page } from '../models/task.ts'
import { BodyState } from './BodyState.svelte.ts'

const [get, set, has] = createContext<BodyState>()

export function useBody(page: () => Page): BodyState {
  if (has()) {
    return get()
  }
  return set(new BodyState(page))
}
