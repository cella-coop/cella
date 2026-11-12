import { browser } from '$app/env'
import { generate } from '@cella/org-sign'
import { keep } from './kept.svelte.ts'
import { took } from '../post.ts'
import type { WriteState } from './WriteState.svelte.ts'

// Taking up an invitation: a fresh device key, made and kept here, its
// private half not exportable; the acceptance sent with its public key
// and signed by it through the relay, by the link's write; then, signed
// in, the invitee's own page, loaded afresh under the new session. Until
// this browser runs the page's script, its button does nothing, so the
// page the server sends reads as busy and a click waits for it.
export class JoinState {
  busy = $state(!browser)
  problem = $state<string | null>(null)
  // What the invitee calls this device.
  label = $state('')

  constructor(
    readonly scope: () => string,
    readonly member: () => string,
    readonly writes: WriteState,
  ) {}

  async take() {
    this.busy = true
    this.problem = null
    try {
      const device = { ...(await generate(this.member())), scope: this.scope(), label: this.label.trim() || 'first device' }
      await keep(device)
      const result = await this.writes.send('accept', [
        ['key', device.key],
        ['label', device.label],
      ])
      if (took(result)) {
        location.assign(`/people/${encodeURIComponent(this.member())}?tab=joining`)
        return
      }
      this.problem = ('done' in result ? result.done?.reason : undefined) ?? 'the invitation could not be taken up'
    } finally {
      this.busy = false
    }
  }
}
