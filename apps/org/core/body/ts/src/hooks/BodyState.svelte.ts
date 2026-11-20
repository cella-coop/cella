import { onMount, untrack } from 'svelte'
import { useWrites } from '@cella/org-ui'
import { b64, canonical, createDoc, type Bodied, type Canon, type LoroDoc } from '../models/index.ts'
import { LiveState } from './LiveState.svelte.ts'

type Page = Bodied & { id: string }

// A record's body in the browser, by its collection: a Loro document
// made from the page's snapshot as the body mounts, kept live over core
// body's session until it unmounts, and saved by this browser through
// the record's own `save` write, named by its collection, signed by its
// device. The server renders it to read; the editor takes it over once
// the session says this member may edit it, and one who may not reads
// it as it changes. When a write refreshes the page, its snapshot is
// merged in, which Loro does without changing what is already there.
export class BodyState {
  readonly #page: () => Page
  doc: LoroDoc | null = $state.raw(null)
  live: LiveState | null = $state.raw(null)

  constructor(collection: () => string, page: () => Page) {
    this.#page = page
    const writes = useWrites()
    onMount(() => {
      const doc = createDoc()
      const snapshot = this.#page().snapshot
      if (snapshot) {
        doc.import(b64.decode(snapshot))
      }
      const id = this.#page().id
      const live = new LiveState(doc, {
        live: () => `/${collection()}/${encodeURIComponent(id)}/body/live`,
        save: (write, fields) => writes.send(write, fields, id, collection()),
        who: () => `${writes.actor}|${writes.copy}`,
      })
      const stop = live.start()
      this.doc = doc
      this.live = live
      return () => {
        stop()
        this.doc = null
        this.live = null
      }
    })
    $effect(() => {
      const snapshot = this.#page().snapshot
      if (snapshot) {
        untrack(() => this.doc)?.import(b64.decode(snapshot))
      }
    })
  }

  // The body as it reads now: the live document's, which follows every
  // edit that reaches this browser, or the page's until it holds one.
  get canon(): Canon | null {
    const live = this.live
    if (!live || !this.doc) {
      return this.#page().canon
    }
    void live.hash
    return canonical(this.doc)
  }
}
