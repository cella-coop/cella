import { browser } from '$app/env'
import { fixture, generate, open } from '@cella/org-sign'
import qrcode from 'qrcode-generator'
import { pairCode } from '../models/pairing.ts'
import { tick } from 'svelte'
import { forget, keep, kept, type Kept } from './kept.svelte.ts'

// The sign-in while it is under way: the devices this browser keeps for
// the scope, each of which signs in by signing the server's challenge;
// on the dev server, a fixture member's TEST-ONLY key derived here and
// kept as this browser's own; and a key made here for a person to enrol
// from a device they already hold. Signed in, the page loads afresh where
// it was going, under the new session. Until this browser runs the page's
// script, its buttons do nothing, so the page the server sends reads as
// busy and a click waits for them.
export class SignInState {
  devices = $state<Kept[]>([])
  // Whether the devices have been read once: the server cannot know them,
  // so until then the card says nothing of them.
  loaded = $state(false)
  problem = $state<string | null>(null)
  busy = $state(!browser)
  // The person and the device a key is made for, and the key once made,
  // for its person to enrol elsewhere.
  address = $state('')
  label = $state('')
  made = $state<Kept | null>(null)
  // The pairing code of the key made here, shown large for the person to
  // type where it is enrolled.
  code = $state('')
  // Whether the new-browser step is open, and the link just copied.
  opened = $state(false)
  copied = $state(false)
  // The key a person is asked to confirm forgetting, by its public key.
  confirming = $state<string | null>(null)
  // The kept key chosen to sign in with, by its public key; none chosen
  // reads as the first.
  chosen = $state<string | null>(null)

  constructor(
    readonly scope: () => string,
    readonly back: () => string,
  ) {
    if (browser) {
      void this.load()
    }
  }

  // Where a device the person already uses enrols the key made here: their
  // Account settings, the key and its name filled in.
  get link() {
    if (!this.made) {
      return ''
    }
    const q = new URLSearchParams({ enrol: this.made.key, label: this.made.label })
    return `${location.origin}/settings/account?${q}`
  }

  // The link as a QR code: one path of unit squares in a square of `size`.
  get qr(): { d: string; size: number } | null {
    if (!this.made) {
      return null
    }
    const q = qrcode(0, 'M')
    q.addData(this.link)
    q.make()
    const size = q.getModuleCount()
    let d = ''
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (q.isDark(r, c)) {
          d += `M${c} ${r}h1v1h-1z`
        }
      }
    }
    return { d, size }
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.link)
      this.copied = true
      setTimeout(() => (this.copied = false), 1500)
    } catch {
      this.copied = false
    }
  }

  // Forgets a key this browser keeps: the row goes, and nothing is revoked.
  async forget(device: Kept) {
    await forget(this.scope(), device.key)
    this.confirming = null
    await this.load()
  }

  // Back to the card as it was, focus on Link device. A key made here
  // stays, so Link device opens its step again where it left it.
  async leave() {
    this.opened = false
    this.problem = null
    await tick()
    document.querySelector<HTMLElement>('[data-link] button')?.focus()
  }

  async load() {
    this.devices = await kept(this.scope())
    this.loaded = true
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
    this.code = await pairCode(d.key)
    await this.load()
  }
}
