// The notary log as the shell reads it. An entry commits to its payload by
// digest only, so what a write was about is its op and actor, never its
// content.

export interface Guard {
  owner: string
  function: string
  // The BLAKE3 of the guard's text, hex; the text is in cella.guard_text.
  text: string
}

export interface Entry {
  id: string
  n: number
  op: string
  actor: string
  date: string
  guards: Guard[]
  receipt: number
  // When the receipt was signed, as the notary's clock read it.
  at: string
  device: string
  // The ids of the records the entry is about, by the name its form holds
  // each under (`cella.records`): `{ invoice: 'F-2026-004' }`.
  records: Record<string, string | number>
}

export interface Detail extends Entry {
  payload: string
  prev: string
  hash: string
  sig: string
  nonce: string
  request: string
  signature: string
  // Each deciding guard with its source, from the registry of guard texts.
  texts: { owner: string; function: string; text: string; body: string | null }[]
}

export interface Head {
  // Whether `cella.verify_log()` passes: every entry, receipt and signature.
  verified: boolean
  n: number
  // The scope's public key, hex.
  key: string
  scope: string | null
}
