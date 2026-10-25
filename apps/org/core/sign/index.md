+++
title = "Sign"
updated = 2026-10-25
+++

The client side of a write's signature (`@cella/org-sign`): what a
member's device runs to sign each write it asks for, with WebCrypto alone,
Ed25519 and SHA-256, so the same code signs in a browser and in Node. The
message and its binding are in [signatures](../../../../_corpus/doc/signatures.md);
`cella.submit` checks it with `cella_rules::sign`.

- `plain(request)`: the request as the notary reads it, bytes as hex,
  undefined fields dropped, integers only.
- `canonical`, `digest(request, salt)`: canonical JSON, sorted keys and
  no whitespace, and the SHA-256 in hex of `{"request", "salt"}`, which
  hides the request from anyone holding the digest.
- `message`: the exact text a device signs.
- `generate(address)`: a fresh device key, its private half not
  exportable.
- `signer(scope, actor, device)`: a `Signer`, `(op, request) → Proof`,
  signing with a fresh 32-byte salt and 16-byte nonce each write. `Proof`
  is `{ device, salt, nonce, sig }` in hex.
- `opening`, `open(scope, actor, device, challenge)`: the text a device
  signs to open a session, and its signature in hex
  ([signatures](../../../../_corpus/doc/signatures.md#a-sessions-opening));
  `verify(key, text, sig)`, whether a signature in hex is the device's,
  which the server checks a sign-in with.
- `random()`, `sha256(hex)`: 32 random bytes in hex, and the SHA-256 in
  hex of the bytes a hex string holds, as an invitation's link and its
  digest are drawn.
- `fixture(address, label)`: TEST-ONLY. A fixture device's key, derived
  from its address and label so the seed and the tests hold the same key;
  anyone can derive it, so it is never enrolled for a real member.

A handler's `Deps` carries a `Signer`: on a member's device it signs on
the spot; on the shell's server it asks the browser, which signs with this
package and the device it keeps, and returns the proof that came back.
`write` in `@cella/org-db` signs before the transaction opens and hands
the request and its proof to `cella.submit`.
