import { generate } from '@cella/org-sign'
import { keep } from './kept.svelte.ts'
import { post } from '../post.ts'

// Taking up an invitation: a fresh device key, made and kept here, its
// private half not exportable; the acceptance posted with its public key
// and signed by it through the relay; then, signed in, the invitee's own
// page, loaded afresh under the new session.
export class JoinState {
  busy = $state(false)
  problem = $state<string | null>(null)
  // What the invitee calls this device.
  label = $state('')

  constructor(
    readonly scope: () => string,
    readonly member: () => string,
  ) {}

  async take() {
    this.busy = true
    this.problem = null
    try {
      const device = { ...(await generate(this.member())), scope: this.scope(), label: this.label.trim() || 'first device' }
      await keep(device)
      const body = new FormData()
      body.set('key', device.key)
      body.set('label', device.label)
      const result = await post(`${location.pathname}?/accept`, body)
      if (result.type === 'success') {
        location.assign(`/people/${encodeURIComponent(this.member())}?tab=joining`)
        return
      }
      const done = result.type === 'failure' ? (result.data as { done?: { reason?: string } } | undefined)?.done : undefined
      this.problem = done?.reason ?? 'the invitation could not be taken up'
    } finally {
      this.busy = false
    }
  }
}
