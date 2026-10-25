// A member's device signs every write it asks for. The signature covers a
// domain-separated text naming the scope, the op, the actor, the device,
// the request's digest and a single-use nonce, so it names its request and
// counts once; the notary checks it in `cella.submit` before any rule runs.
// Only WebCrypto is used, Ed25519 and SHA-256, so the same code signs in a
// browser and in Node. The message format is `cella_rules::sign`'s.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

// What a handler hands the notary beside the request, in hex: the signing
// device's public key, the request's salt, the nonce and the signature.
export interface Proof {
  device: string
  salt: string
  nonce: string
  sig: string
}

// Signs one write. On a member's device it signs on the spot; a server
// handing on a request returns the proof that came with it.
export type Signer = (op: string, request: Json) => Promise<Proof>

// A device key: its address, its public key in hex, and the private key,
// which never leaves the device.
export interface Device {
  address: string
  key: string
  secret: CryptoKey
}

export const WRITE = 'cella org 2026-10 write'

const ED25519 = { name: 'Ed25519' }

export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (b) => parseInt(b, 16))

const utf8 = (s: string) => new TextEncoder().encode(s)

const base64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0))

// A request as the notary reads it: bytes as hex, undefined fields
// dropped, integers only, as the log's canonical JSON allows.
export function plain(v: unknown): Json {
  if (v instanceof Uint8Array) {
    return hex(v)
  }
  if (v === null || typeof v === 'boolean' || typeof v === 'string') {
    return v
  }
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) {
      throw new Error(`a signed request holds integers only, got ${v}`)
    }
    return v
  }
  if (Array.isArray(v)) {
    return v.map((x) => (x === undefined ? null : plain(x)))
  }
  if (typeof v === 'object') {
    const out: { [key: string]: Json } = {}
    for (const [k, x] of Object.entries(v)) {
      if (x !== undefined) {
        out[k] = plain(x)
      }
    }
    return out
  }
  throw new Error(`a signed request holds no ${typeof v}`)
}

// Sorted keys, no whitespace: the same text the notary hashes.
export function canonical(v: Json): string {
  if (Array.isArray(v)) {
    return `[${v.map(canonical).join(',')}]`
  }
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

// The request's digest: SHA-256 over the canonical JSON of the request and
// its salt, in hex. A fresh salt each write keeps the digest the log holds
// from confirming a guess of what the member typed.
export async function digest(request: Json, salt: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(canonical({ request, salt })))))
}

export interface Signed {
  scope: string
  op: string
  actor: string
  device: string
  request: string
  nonce: string
}

// The exact text a device signs, one `name value` line each.
export const message = (m: Signed) =>
  `${WRITE}\nscope ${m.scope}\nop ${m.op}\nactor ${m.actor}\ndevice ${m.device}\nrequest ${m.request}\nnonce ${m.nonce}\n`

// A key from its 32-byte Ed25519 seed, wrapped as PKCS #8, which WebCrypto
// imports.
async function fromSeed(address: string, seed: Uint8Array): Promise<Device> {
  const der = new Uint8Array([...unhex('302e020100300506032b657004220420'), ...seed])
  const secret = await crypto.subtle.importKey('pkcs8', der, ED25519, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', secret)
  return { address, key: hex(base64url(jwk.x ?? '')), secret }
}

// A fresh device key, as a device makes one; its private key cannot be
// exported.
export async function generate(address: string): Promise<Device> {
  const pair = (await crypto.subtle.generateKey(ED25519, false, ['sign', 'verify'])) as CryptoKeyPair
  const key = hex(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
  return { address, key, secret: pair.privateKey }
}

// TEST-ONLY. A fixture's device key, derived from its address and label so
// that the seed and the tests hold the same key. Anyone can derive it: it
// must never be enrolled for a real member.
export async function fixture(address: string, label: string): Promise<Device> {
  const seed = await crypto.subtle.digest('SHA-256', utf8(`cella fixture device key, test-only, never a member's\n${address}\n${label}`))
  return fromSeed(address, new Uint8Array(seed))
}

// Signs as `actor` with `device`, a fresh salt and nonce each write.
export function signer(scope: string, actor: string, device: Device | Promise<Device>): Signer {
  return async (op, request) => {
    const d = await device
    const salt = hex(crypto.getRandomValues(new Uint8Array(32)))
    const nonce = hex(crypto.getRandomValues(new Uint8Array(16)))
    const text = message({ scope, op, actor, device: d.key, request: await digest(request, salt), nonce })
    const sig = new Uint8Array(await crypto.subtle.sign(ED25519, d.secret, utf8(text)))
    return { device: d.key, salt, nonce, sig: hex(sig) }
  }
}

export const SESSION = 'cella org 2026-10 session'

export interface Opening {
  scope: string
  actor: string
  device: string
  challenge: string
}

// The exact text a device signs to open a session: the server's
// single-use challenge, so a signature opens one session and no other.
export const opening = (o: Opening) => `${SESSION}\nscope ${o.scope}\nactor ${o.actor}\ndevice ${o.device}\nchallenge ${o.challenge}\n`

// Signs a session's opening as `actor` with `device`; the signature in hex.
export async function open(scope: string, actor: string, device: Device, challenge: string): Promise<string> {
  const text = opening({ scope, actor, device: device.key, challenge })
  return hex(new Uint8Array(await crypto.subtle.sign(ED25519, device.secret, utf8(text))))
}

// Whether `sig`, in hex, is the signature of `text` by the device whose
// public key is `key`, in hex.
export async function verify(key: string, text: string, sig: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(key) || !/^[0-9a-f]{128}$/.test(sig)) {
    return false
  }
  const pub = await crypto.subtle.importKey('raw', unhex(key), ED25519, false, ['verify'])
  return crypto.subtle.verify(ED25519, pub, unhex(sig), utf8(text))
}

// 32 random bytes in hex, as an invitation's link holds.
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)))

// SHA-256 in hex of the bytes a hex string holds, as a link's digest.
export async function sha256(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', unhex(s))))
}
