import { createContext } from 'svelte'
import type { BodiedDistribution } from '../models/body-distribution.ts'
import { BodyStateDistribution } from './BodyStateDistribution.svelte.ts'

const [get, set, has] = createContext<BodyStateDistribution>()

export function useBodyDistribution(page: () => BodiedDistribution & { id: string }): BodyStateDistribution {
  if (has()) {
    return get()
  }
  return set(new BodyStateDistribution(page))
}
