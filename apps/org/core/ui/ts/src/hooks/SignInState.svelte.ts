import { browser } from '$app/env'
import { fixture, generate, open } from '@cella/org-sign'
import { keep, kept, type Kept } from './kept.svelte.ts'

// The sign-in while it is under way: the devices this browser keeps for
// the scope, each of which signs in by signing the server's challenge;
// on the dev server, a fixture member's TEST-ONLY key derived here and
// kept as this browser's own; and a key made here for a person to enrol
// from a device they already hold. Signed in, the page loads afresh where
// it was going, under the new session.
export class SignInState {
  devices = $state<Kept[]>([])
  problem = $state<string | null>(null)
  busy = $state(false)
  // The person and the device a key is made for, and the key once made,
  // for its person to enrol elsewhere.
  address = $state('')
  label = $state('')
  made = $state<Kept | null>(null)

  constructor(
    readonly scope: () => string,
    readonly back: () => string,
  ) {
    if (browser) {
      void this.load()
    }
  }

  async load() {
    this.devices = await kept(this.scope())
  }

  // Signs in on a device this browser keeps.
  async as(device: Kept) {
    this.busy = true
    this.problem = null
    try {
      const { challenge } = (await (await fetch('/session')).json()) as { challenge: string }
      const sig = await open(this.scope(), device.address, device, challenge)
      const res = await fetch('/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: device.address, device: device.key, challenge, sig }),
      })
      if (!res.ok) {
        this.problem = ((await res.json()) as { reason?: string }).reason ?? `the sign-in was refused (${res.status})`
        return
      }
      location.assign(this.back())
    } finally {
      this.busy = false
    }
  }

  // DEV ONLY: signs in as a fixture member, deriving their device's key.
  async fixture(address: string, label: string) {
    const d = { ...(await fixture(address, label)), scope: this.scope(), label }
    await keep(d)
    await this.as(d)
  }

  // Makes a key for this browser, to be enrolled from another device of
  // the same person.
  async make() {
    const d = { ...(await generate(this.address.trim())), scope: this.scope(), label: this.label.trim() || 'this browser' }
    await keep(d)
    this.made = d
    await this.load()
  }
}
