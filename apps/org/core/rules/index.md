+++
title = "Rules"
updated = 2026-10-24
+++

The rule primitives, in a pure Rust crate (`cella-rules`): no pgrx, no clock, no I/O, no floats, every sum overflow-checked, `unsafe` forbidden. The `cella` extension (`core/notary/rs`) wraps them as SQL; the same crate compiles to WASM for devices and auditors.

- `Amount`, positive cents, and `Balance`, signed cents.
- `Tally`, the fold over (member, stance, receipt): each member's stance with the highest receipt counts, so the fold is the same in any order. `consent` passes when someone consents and no one objects; `majority` when more are for than against. A stance foreign to the rule is an error, not a vote.
- `allocate`, an exact proportional split: floors first, then a cent each to the largest remainders, ties to the earlier part; the parts sum to the total.
- `digest`, the plain BLAKE3 of content, as `b3sum` computes it, so a saved text can be checked without cella; a document version's hash is this over its canonical text.
- `log`, the notary log: a canonical JSON payload digest (sorted keys, integers only); `Receipt`, the notary's acknowledgement of a write carrying the member's signature, and its hash; the entry's BLAKE3 hash over the previous hash, naming its receipt; Ed25519 signing; and `Chain`, which checks a log from its first entry, each entry's receipt with it.
- `sign`, a member's write signature: the domain-separated message naming the scope, op, actor, device, request digest (SHA-256 of the canonical request) and nonce, and its strict Ed25519 check. The register of every signed type is [signatures](../../../../_corpus/doc/signatures.md).
- `hex`, lowercase hex with one spelling per byte string.

It uses `blake3`, `sha2` and `ed25519-dalek` directly rather than `core/crypto` and `core/log`: those carry the cell runtime's claim format, wall-clock timestamps and the age, Shamir and post-quantum dependencies, none of which a backend library or a WASM build should load.
