import { onMount, untrack } from 'svelte'
import { b64, createDoc, type LoroDoc } from '@cella/org-body/models'
import { SyncState } from '@cella/org-body/app'
import { useWrites } from '@cella/org-ui'
import type { Page } from '../models/document.ts'

// A document's draft in the browser: a Loro document made from the page's
// snapshot as the draft mounts, kept live by its sync until it unmounts.
// The server renders the draft as a reader; the editor takes over once
// the browser holds the document. When a write refreshes the page, its
// snapshot is merged in, which Loro does without changing what is
// already there.
export class DraftState {
  readonly #page: () => Page
  doc: LoroDoc | null = $state.raw(null)
  sync: SyncState | null = $state.raw(null)

  constructor(page: () => Page) {
    this.#page = page
    // Its edits are the document's `edit` write, sent for its item.
    const writes = useWrites()
    onMount(() => {
      const doc = createDoc()
      doc.import(b64.decode(this.#page().snapshot))
      const at = () => `/documents/${encodeURIComponent(this.#page().id)}`
      const sync = new SyncState(doc, { live: () => `${at()}/live`, edit: (fields) => writes.send('edit', fields, this.#page().id, 'documents') })
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
