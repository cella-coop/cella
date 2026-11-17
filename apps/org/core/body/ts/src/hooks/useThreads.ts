import { createContext } from 'svelte'
import type { Named } from '../models/thread.ts'
import { ThreadsState } from './ThreadsState.svelte.ts'

const [get, set, has] = createContext<ThreadsState>()

export function useThreads(readers: () => Promise<Named[]>): ThreadsState {
  if (has()) {
    return get()
  }
  return set(new ThreadsState(readers))
}
