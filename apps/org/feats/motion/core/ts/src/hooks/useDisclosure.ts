import { createContext } from 'svelte'
import type { Disclosure } from '../models/disclosure.ts'
import { DisclosureState } from './DisclosureState.svelte.ts'

const [get, set, has] = createContext<DisclosureState>()

export function useDisclosure(disclosure: () => Disclosure): DisclosureState {
  if (has()) {
    return get()
  }
  return set(new DisclosureState(disclosure))
}
