import { createContext } from 'svelte'
import { EditorState } from './EditorState.svelte.ts'
import type { LoroDoc } from 'loro-crdt'

const [get, set, has] = createContext<EditorState>()

// The editor's state: the one an editor put in context, which its blocks
// read; the editor itself hands the doc the first time.
export function useEditor(doc?: () => LoroDoc): EditorState {
  if (has()) {
    return get()
  }
  if (!doc) {
    throw new Error('useEditor: no editor above, and no doc to start one')
  }
  return set(new EditorState(doc()))
}
