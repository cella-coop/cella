import { createContext } from 'svelte'
import type { BodiedTerms } from '../models/body-terms.ts'
import { BodyStateTerms } from './BodyStateTerms.svelte.ts'

const [get, set, has] = createContext<BodyStateTerms>()

export function useBodyTerms(page: () => BodiedTerms & { id: string }): BodyStateTerms {
  if (has()) {
    return get()
  }
  return set(new BodyStateTerms(page))
}
