import { untrack } from 'svelte'
import type { LoroDoc } from 'loro-crdt'
import { createDoc } from '../models/blocks.ts'
import { b64, type Page } from '../models/document.ts'
import { SyncState } from './SyncState.svelte.ts'

// A document's draft in the browser: a Loro document made from the page's
// snapshot, kept live by its sync. The server renders the draft as a
// reader; the editor takes over once the browser holds the document.
// When a write refreshes the page, its snapshot is merged in, which Loro
// does without changing what is already there.
export class DraftState {
  readonly #page: () => Page
  doc: LoroDoc | null = $state.raw(null)
  sync: SyncState | null = $state.raw(null)

  constructor(page: () => Page) {
    this.#page = page
    $effect(() => {
      const p = untrack(() => this.#page())
      const doc = createDoc()
      doc.import(b64.decode(p.snapshot))
      const sync = new SyncState(doc, () => `/documents/${encodeURIComponent(this.#page().id)}`)
      const stop = sync.start()
      this.doc = doc
      this.sync = sync
      return () => {
        stop()
        this.doc = null
        this.sync = null
      }
    })
    $effect(() => {
      const snapshot = this.#page().snapshot
      untrack(() => this.doc)?.import(b64.decode(snapshot))
    })
  }
}
