import { createContext } from 'svelte'
import type { Comment, Named } from '../models/thread.ts'
import { ThreadsState } from './ThreadsState.svelte.ts'

const [get, set, has] = createContext<ThreadsState>()

export function useThreads(comments: () => Comment[], readers: () => Named[]): ThreadsState {
  if (has()) {
    return get()
  }
  return set(new ThreadsState(comments, readers))
}
