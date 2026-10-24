import { seed } from '../seed.ts'
import { EditorState } from './EditorState.svelte.ts'

// Two editors on two LoroDocs, synced in the page. Each side's local
// updates go to the other at once while online, and queue while offline;
// going online exchanges what each lacks. A side mid-composition holds
// incoming updates until the composition ends.
export class PairState {
  readonly a: EditorState
  readonly b: EditorState
  online = $state(true)
  queued = $state(0)
  get converged() {
    return this.a.hash === this.b.hash
  }
  #held = new Map<EditorState, Uint8Array[]>()

  constructor(snapshot: Uint8Array = seed()) {
    this.a = new EditorState('A', snapshot)
    this.b = new EditorState('B', snapshot)
    this.#link(this.a, this.b)
    this.#link(this.b, this.a)
  }

  #link(from: EditorState, to: EditorState) {
    from.engine.doc.subscribeLocalUpdates((bytes) => {
      if (this.online) {
        this.deliver(to, [bytes])
      } else {
        this.queued++
      }
    })
  }

  deliver(to: EditorState, updates: Uint8Array[]) {
    if (to.composing) {
      this.#held.set(to, [...(this.#held.get(to) ?? []), ...updates])
      return
    }
    const restore = to.pin()
    for (const u of updates) {
      to.engine.doc.import(u)
    }
    restore?.()
  }

  // Called when a side's composition ends.
  release(side: EditorState) {
    const held = this.#held.get(side)
    this.#held.delete(side)
    if (held?.length) {
      this.deliver(side, held)
    }
  }

  setOnline(on: boolean) {
    this.online = on
    if (!on) {
      return
    }
    const da = this.a.engine.doc
    const db = this.b.engine.doc
    const toB = da.export({ mode: 'update', from: db.oplogVersion() })
    const toA = db.export({ mode: 'update', from: da.oplogVersion() })
    this.deliver(this.b, [toB])
    this.deliver(this.a, [toA])
    this.queued = 0
  }
}
