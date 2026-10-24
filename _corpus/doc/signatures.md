+++
title = "Signatures"
updated = 2026-10-24
+++

# Signatures

Every signed artifact names its binding, and each signed type is
domain-separated ([trust](trust.md#keys-and-addresses)): a signature on one
thing never verifies another. This page lists every signed type and every
digest the log holds, with its domain tag and what binds it. A new signed
type is added here before it is signed anywhere.

## Signed types

| Type | Signer | Tag | Binding | Checked by |
|---|---|---|---|---|
| write | a member's device, Ed25519 | `cella org 2026-10 write`, the message's first line | the scope, the op, the actor, the device's key, the request's digest, and a single-use nonce | `cella.submit` before any rule; `cella.verify_log` again |
| receipt | the scope's notary key, Ed25519 | `cella org 2026-10 receipt`, the BLAKE3 derive-key context of the signed hash | its number, the op, the actor, the device, the nonce, the request's digest, the member's signature, the payload's digest and the time it arrived | `cella.verify_log` |
| log entry | the scope's notary key, Ed25519 | `cella org 2026-10 log entry`, the BLAKE3 derive-key context of the signed hash | the previous entry's hash, its number, the op, the actor, the verdict date, the payload's digest, its receipt's number and hash, and each deciding rule | `cella.verify_log` |

### A write

The device signs this text, UTF-8, one `name value` line each, every line
ending in a newline:

```text
cella org 2026-10 write
scope lanterne.example
op invoice:invoice:issue
actor julien@lanterne.example
device <the device's public key, 64 lowercase hex digits>
request <SHA-256 of the request's canonical JSON, 64 lowercase hex digits>
nonce <16 random bytes, 32 lowercase hex digits>
```

- **scope** is the scope's address, the `cella.scope` setting, so a
  signature verifies in no other scope.
- **request** is what the member asked for, the handler's input, not the
  payload the verdict commits to: the server fills the payload in (an
  invoice's number, a stance's receipt) after the member signed. Its
  canonical JSON has sorted keys, no whitespace and integers only; bytes
  travel as hex. SHA-256 rather than BLAKE3, because browsers sign with
  WebCrypto, which has SHA-256 and no BLAKE3.
- **nonce** makes the signature count once: the notary refuses a write
  whose device and nonce a receipt already holds. A refused write rolls
  back, so its nonce is not spent.
- No field may be empty or hold a control character, so no field can
  forge a line.

The signature is checked strictly (`verify_strict`): no weak keys and no
malleable signatures. `apps/org/core/sign/ts` builds and signs the message
in TypeScript; `cella_rules::sign` builds and checks it in Rust.

### A receipt and an entry

`submit` signs the receipt once the write's rules accept, then the entry,
which names the receipt by number and hash, so a verdict cannot be moved
to another receipt and a receipt cannot be moved to another write. The
receipt's time orders nothing; receipt numbers order stances.

## Digests

| Digest | Function | Tag | Over |
|---|---|---|---|
| payload | BLAKE3 derive-key | `cella org 2026-10 log payload` | the payload's canonical JSON |
| request | SHA-256 | none: the write message's tag separates it | the request's canonical JSON |
| rule text | BLAKE3 derive-key | `cella org 2026-10 rule text` | a rule's definition, as `pg_get_functiondef` gives it |
| content | BLAKE3, plain | none: it names content, as `b3sum` computes it | a document version's canonical text |

The payload and request digests are not salted; see the trust doc's
current limits.

## Keys that sign nothing real

Lanterne's fixture devices hold keys derived from their address and label
(`fixture` in `@cella/org-sign`, tagged `cella fixture device key,
test-only, never a member's`). Anyone can compute them; they exist so
that the seed and the tests hold the same keys, and are never enrolled
for a real member.

## Not yet signed

- Confluent writes in signed batches, which come with the offline queue
  at rung 2; each write is signed and received on its own until then.
- Thresholds as signed policy, guardian shares and recovery are not built.
- At rung 5 a receipt or an entry shown to another scope will also name
  its audience.
