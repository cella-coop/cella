// The pairing code of a key: a short code both browsers derive from the
// new browser's public key, shown large there and typed by hand where it
// is enrolled, so a link that carries someone else's key cannot be
// enrolled by a click alone. Six characters of base32 (no I, L, O, U or
// digits that read alike) from a hash of the key, grouped "K7Q-4MX".
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export async function pairCode(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(`cella pairing ${key.trim().toLowerCase()}`)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  let bits = 0n
  for (const b of hash.slice(0, 4)) {
    bits = (bits << 8n) | BigInt(b)
  }
  let out = ''
  for (let i = 0; i < 6; i++) {
    out = ALPHABET[Number(bits & 31n)] + out
    bits >>= 5n
  }
  return `${out.slice(0, 3)}-${out.slice(3)}`
}

// Whether what was typed is the code, ignoring case, dashes and spaces.
export const sameCode = (typed: string, code: string) => {
  const flat = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()
  return code !== '' && flat(typed) === flat(code)
}
