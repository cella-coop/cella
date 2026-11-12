import { createContext } from 'svelte'
import { JoinState } from './JoinState.svelte.ts'
import { useWrites } from './useWrites.ts'

const [get, set, has] = createContext<JoinState>()

export function useJoin(scope: () => string, member: () => string): JoinState {
  if (has()) {
    return get()
  }
  return set(new JoinState(scope, member, useWrites()))
}
