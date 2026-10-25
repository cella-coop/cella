import { createContext } from 'svelte'
import type { Message } from '../models/thread.ts'
import { ThreadState } from './ThreadState.svelte.ts'

const [get, set, has] = createContext<ThreadState>()

export function useThread(messages: () => Message[]): ThreadState {
  if (has()) {
    return get()
  }
  return set(new ThreadState(messages))
}
