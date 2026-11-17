import { createContext } from 'svelte'
import { InviteState } from './InviteState.svelte.ts'

const [get, set, has] = createContext<InviteState>()

export function useInvite(): InviteState {
  if (has()) {
    return get()
  }
  return set(new InviteState())
}
