import type { LoroDoc } from 'loro-crdt'
import { hash } from '../model/canonical.ts'

// Two docs that sync in the page, as two clients would over a wire: each
// local commit's update goes to the other after a delay, or waits in a
// queue while the link is off.
export class PairState {
  readonly docs: [LoroDoc, LoroDoc]
  online = $state(true)
  delay = $state(0)
  hashes: [string, string] = $state(['', ''])
  queued: [number, number] = $state([0, 0])
  #queues: [Uint8Array[], Uint8Array[]] = [[], []]

  constructor(a: LoroDoc, b: LoroDoc) {
    this.docs = [a, b]
    for (const i of [0, 1] as const) {
      this.docs[i].subscribeLocalUpdates((bytes) => this.#send(i, bytes))
      this.docs[i].subscribe(() => this.#rehash(i))
      this.#rehash(i)
    }
  }

  #rehash(i: 0 | 1): void {
    this.hashes[i] = hash(this.docs[i])
  }

  #send(from: 0 | 1, bytes: Uint8Array): void {
    this.#queues[from].push(bytes)
    this.queued[from] = this.#queues[from].length
    if (this.online) {
      this.#deliver(from)
    }
  }

  #deliver(from: 0 | 1): void {
    const go = () => {
      const q = this.#queues[from].splice(0)
      this.queued[from] = 0
      if (q.length) {
        this.docs[from === 0 ? 1 : 0].importBatch(q)
      }
    }
    if (this.delay) {
      setTimeout(() => this.online && go(), this.delay)
    } else {
      queueMicrotask(go)
    }
  }

  toggle(online = !this.online): void {
    this.online = online
    if (online) {
      this.#deliver(0)
      this.#deliver(1)
    }
  }

  converged = $derived(this.hashes[0] === this.hashes[1] && this.queued[0] === 0 && this.queued[1] === 0)
}
