import { createContext } from 'svelte'
import type { Person } from '../models/view.ts'
import { RememberState } from './RememberState.svelte.ts'

const [get, set, has] = createContext<RememberState>()

// Puts the shell's remembering in context: on each render signed in, it
// keeps the actor's name and circles fresh on the devices this browser
// keeps for them, read for the sign-in page's own use once they sign out.
export function useRemember(scope: () => string, actor: () => Person | null, circles: () => { name: string; sits: boolean; assembly?: boolean }[]): RememberState {
  if (has()) {
    return get()
  }
  return set(new RememberState(scope, actor, circles))
}
