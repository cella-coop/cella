import { createContext } from 'svelte'
import { FileState } from './FileState.svelte.ts'

const [, set] = createContext<FileState>()

// A file picker's own state, new for each picker.
export function useFile(): FileState {
  return set(new FileState())
}
