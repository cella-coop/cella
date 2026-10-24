+++
title = "Rules"
updated = 2026-10-24
+++

The rule primitives, in a pure Rust crate (`cella-rules`): no pgrx, no clock, no I/O, no floats, every sum overflow-checked, `unsafe` forbidden. The `cella` extension (`core/notary/rs`) wraps them as SQL; the same crate compiles to WASM for devices and auditors.

- `Amount`, positive cents, and `Balance`, signed cents.
- `Tally`, the fold over (member, stance, receipt): each member's stance with the highest receipt counts, so the fold is the same in any order. `consent` passes when someone consents and no one objects; `majority` when more are for than against. A stance foreign to the rule is an error, not a vote.
- `allocate`, an exact proportional split: floors first, then a cent each to the largest remainders, ties to the earlier part; the parts sum to the total.
- `digest`, the plain BLAKE3 of content, as `b3sum` computes it, so saved content can be checked without cella.
- `document`, a document's canonical form: the block tree of a Loro snapshot (`loro`, pinned to the version the browser's `loro-crdt` encodes) written as RFC 8785 JSON, `{"blocks":[…],"v":1}`, each block with its type, the props its type keeps, its text as runs with their marks and its children, ids left out, empty runs and children left out; `hash`, the `digest` of those bytes, which names a version; and `plain`, its text block by block. A number that is not a safe integer, an unknown type or bytes that are not a whole Loro document have no canonical form and are refused. The document feat's TypeScript canonicaliser writes the same bytes, which its slice tests check on hundreds of random documents ([trust](../../../../_corpus/doc/trust.md#what-a-decision-adopts)).
- `log`, the notary log: a canonical JSON payload digest (sorted keys, integers only); `Receipt`, the notary's acknowledgement of a write carrying the member's signature, and its hash; the entry's BLAKE3 hash over the previous hash, naming its receipt; Ed25519 signing; and `Chain`, which checks a log from its first entry, each entry's receipt with it.
- `sign`, a member's write signature: the domain-separated message naming the scope, op, actor, device, request digest (SHA-256 of the canonical `{"request", "salt"}`) and nonce, and its strict Ed25519 check.
- `vault`, personal data out of the log: the `$personal` and `$erase` markers a payload carries and the logged form that replaces them; the salted commitment to a value under its own domain and its check; sealing with XChaCha20-Poly1305 bound to a row, and the wrap key derived from the scope's seed; reading a logged form back with gaps as `redacted`; and a retention clock in whole years past the end of a year. Salts, keys and nonces come from the caller, so the crate stays free of I/O. The register of every signed type is [signatures](../../../../_corpus/doc/signatures.md).
- `hex`, lowercase hex with one spelling per byte string.

It uses `blake3`, `sha2`, `ed25519-dalek`, `chacha20poly1305` (without its random source) and `loro` directly rather than `core/crypto` and `core/log`: those carry the cell runtime's claim format, wall-clock timestamps and the age, Shamir and post-quantum dependencies, none of which a backend library or a WASM build should load.
