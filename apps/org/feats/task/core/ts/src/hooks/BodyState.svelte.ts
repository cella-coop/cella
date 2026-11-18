import { onMount, untrack } from 'svelte'
import { b64, canonical, createDoc, type Canon, type LoroDoc } from '@cella/org-body/models'
import { LiveState } from '@cella/org-body/app'
import { useWrites } from '@cella/org-ui'
import type { Page } from '../models/task.ts'

// A task's body in the browser: a Loro document made from the page's
// snapshot as the body mounts, kept live over core body's session until
// it unmounts, and saved by this browser through the task's `save` write,
// signed by its device. The server renders the body as a reader; the
// editor takes over once the session says this browser may edit, and one
// who may not reads it as it changes. When a write refreshes the page,
// its snapshot is merged in, which Loro does without changing what is
// already there.
export class BodyState {
  readonly #page: () => Page
  doc: LoroDoc | null = $state.raw(null)
  live: LiveState | null = $state.raw(null)

  constructor(page: () => Page) {
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
        live: () => `/tasks/${encodeURIComponent(id)}/body/live`,
        save: (write, fields) => writes.send(write, fields, id, 'tasks'),
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
