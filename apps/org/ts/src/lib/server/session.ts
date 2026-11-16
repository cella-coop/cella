import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Cookies } from '@sveltejs/kit'
import type { Db } from '@cella/org-db'
import { devices } from '@cella/org-person/api'
import { opening, verify } from '@cella/org-sign'
import { CELLA_SESSION_KEY_FILE } from '$app/env/private'

// A session: a person signed in on one of their enrolled devices. The
// device opens it by signing a single-use challenge with its own key
// (`opening` in `@cella/org-sign`); the server then keeps it in a cookie
// it MACs with its session key, and every request checks the device is
// still enrolled and not revoked. A session lets a person read and ask
// for writes; each write is still signed by the device itself.

export interface Session {
  actor: string
  device: string
}

export const COOKIE = 'cella-session'

// The server's session key: 32 bytes from the file `CELLA_SESSION_KEY_FILE`
// names, which `cella serve` keeps in the data directory, or fresh for
// this process alone, whose sessions then end with it.
const key = CELLA_SESSION_KEY_FILE ? readFileSync(CELLA_SESSION_KEY_FILE) : randomBytes(32)
if (key.length !== 32) {
  throw new Error(`${CELLA_SESSION_KEY_FILE} holds ${key.length} bytes; a session key is 32`)
}

const mac = (text: string) => createHmac('sha256', key).update(text).digest('hex')

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

// How long a challenge may wait for its signature, and a session lasts.
const CHALLENGE = 2 * 60 * 1000
const LASTS = 14 * 24 * 60 * 60 * 1000

// The challenges answered, until they expire, so each opens one session.
const answered = new Map<string, number>()

// A fresh challenge: when it expires, 16 random bytes, and the server's
// MAC over both, so the server keeps nothing until it is answered.
export function challenge(): string {
  const expires = Date.now() + CHALLENGE
  const nonce = randomBytes(16).toString('hex')
  return `${expires}.${nonce}.${mac(`challenge\n${expires}\n${nonce}`)}`
}

// Whether a challenge is this server's, unexpired and not answered yet;
// it counts as answered from here on.
function answers(c: string): boolean {
  const [expires, nonce, m] = c.split('.')
  const now = Date.now()
  for (const [k, until] of answered) {
    if (until < now) {
      answered.delete(k)
    }
  }
  if (!expires || !nonce || !m || !same(m, mac(`challenge\n${expires}\n${nonce}`)) || Number(expires) < now || answered.has(c)) {
    return false
  }
  answered.set(c, Number(expires))
  return true
}

// Whether `device` is a current key of `actor`: enrolled under their
// address and not revoked, as the keyring says.
export async function current(db: Db, actor: string, device: string): Promise<boolean> {
  return (await devices(db, actor)).some((d) => d.key === device && !d.revoked)
}

// Opens a session from a device's signature over a challenge, or says
// why not.
export async function opens(db: Db, scope: string, o: Session & { challenge: string; sig: string }): Promise<Session | string> {
  if (!answers(o.challenge)) {
    return 'the sign-in took too long, or was answered already; try again'
  }
  if (!(await verify(o.device, opening({ scope, actor: o.actor, device: o.device, challenge: o.challenge }), o.sig))) {
    return 'the signature does not verify'
  }
  if (!(await current(db, o.actor, o.device))) {
    return 'this device is not a current device of ' + o.actor
  }
  return { actor: o.actor, device: o.device }
}

const sealed = (s: Session, until: number) => `session\n${s.actor}\n${s.device}\n${until}`

// Keeps a session in its cookie, readable by the server alone, and
// clears the lens, so a sign-in lands in the assembly, and the changes to
// propose another session gathered, which are that session's draft.
export function keep(cookies: Cookies, s: Session, secure: boolean) {
  const until = Date.now() + LASTS
  const value = [Buffer.from(s.actor).toString('base64url'), s.device, until, mac(sealed(s, until))].join('.')
  cookies.set(COOKIE, value, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: LASTS / 1000 })
  cookies.delete('cella-lens', { path: '/', secure })
  cookies.delete('cella-basket', { path: '/', secure })
}

export function end(cookies: Cookies, secure: boolean) {
  cookies.delete(COOKIE, { path: '/', secure })
  cookies.delete('cella-basket', { path: '/', secure })
}

// The session a request's cookie holds, if its MAC is the server's, it
// has not expired, and its device is still current.
export async function read(db: Db, cookies: Cookies): Promise<Session | null> {
  const [actor64, device, until, m] = (cookies.get(COOKIE) ?? '').split('.')
  if (!actor64 || !device || !until || !m) {
    return null
  }
  const s = { actor: Buffer.from(actor64, 'base64url').toString(), device }
  if (!same(m, mac(sealed(s, Number(until)))) || Number(until) < Date.now()) {
    return null
  }
  return (await current(db, s.actor, s.device)) ? s : null
}
