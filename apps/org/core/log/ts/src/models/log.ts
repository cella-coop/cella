// The notary log as the shell reads it. An entry commits to its payload by
// digest only, so what a write was about is its op and actor, never its
// content.

export interface Rule {
  owner: string
  function: string
  // The BLAKE3 of the rule's text, hex; the text is in cella.rule_text.
  text: string
}

export interface Entry {
  id: string
  n: number
  op: string
  actor: string
  date: string
  rules: Rule[]
  receipt: number
  // When the receipt was signed, as the notary's clock read it.
  at: string
  device: string
}

export interface Detail extends Entry {
  payload: string
  prev: string
  hash: string
  sig: string
  nonce: string
  request: string
  signature: string
  // Each deciding rule with its source, from the registry of rule texts.
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
