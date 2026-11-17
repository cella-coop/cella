import { createContext } from 'svelte'
import type { BodiedPeriod } from '../models/body-period.ts'
import { BodyStatePeriod } from './BodyStatePeriod.svelte.ts'

const [get, set, has] = createContext<BodyStatePeriod>()

export function useBodyPeriod(page: () => BodiedPeriod & { id: string }): BodyStatePeriod {
  if (has()) {
    return get()
  }
  return set(new BodyStatePeriod(page))
}
