import { browser } from '$app/env'
import { useWrites } from '@cella/org-ui'
import { untrack } from 'svelte'
import { random, sha256 } from '@cella/org-sign'

// An invitation link while it is made: a secret drawn in this browser,
// whose digest the write `op` carries, and, once that write settles on the
// page, the link holding the secret, for the inviter to pass on. The
// server never sees the secret until the invitee opens the link.
export class LinkState {
  secret = $state('')
  digest = $state('')
  // The last link a settled write made.
  made = $state<string | null>(null)
  #seen: unknown

  constructor(readonly op: string) {
    if (browser) {
      void this.draw()
    }
    const writes = useWrites()
    $effect(() => this.see(writes.done ?? undefined))
  }

  async draw() {
    const s = random()
    this.digest = await sha256(s)
    this.secret = s
  }

  // The page's last outcome: a settled write of the op made the link
  // drawn, so it is shown and the next one drawn.
  see(done: { op?: string; state?: string } | undefined) {
    if (!done || done === this.#seen || done.op !== this.op || done.state !== 'settled') {
      return
    }
    this.#seen = done
    untrack(() => {
      this.made = `${location.origin}/join/${this.secret}`
      void this.draw()
    })
  }
}
