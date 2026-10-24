import { createContext } from 'svelte'
import type { LoroDoc } from 'loro-crdt'
import { useDrag, type Embeds } from '@cella/org-ui'
import type { Anchor } from '../models/document.ts'
import { EditorState } from './EditorState.svelte.ts'

const [get, set, has] = createContext<EditorState>()

export interface Start {
  doc: LoroDoc
  anchors?: Anchor[]
  embeds?: () => Embeds
}

// The editor's state: the one an editor put in context, which its blocks
// read; the editor itself hands its document the first time.
export function useEditor(start?: () => Start): EditorState {
  if (has()) {
    return get()
  }
  if (!start) {
    throw new Error('useEditor: no editor above, and no document to start one')
  }
  const s = start()
  return set(new EditorState(s.doc, useDrag(), s.anchors, s.embeds))
}
