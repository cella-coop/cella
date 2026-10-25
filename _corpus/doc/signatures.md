+++
title = "Signatures"
updated = 2026-10-25
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
| write | a member's device, Ed25519 | `cella org 2026-10 write`, the message's first line | the scope, the op, the actor, the device's key, the salted request's digest, and a single-use nonce | `cella.submit` before any rule; `cella.verify_log` again |
| receipt | the scope's notary key in office, Ed25519, named by its id in `cella.signer` | `cella org 2026-10 receipt`, the BLAKE3 derive-key context of the signed hash | its number, the op, the actor, the device, the nonce, the request's digest, the member's signature, the payload's digest and the time it arrived; the request's salt sits beside it, outside the hash, which holds the digest it salts | `cella.verify_log` |
| log entry | the scope's notary key in office, Ed25519, named by its id in `cella.signer` | `cella org 2026-10 log entry`, the BLAKE3 derive-key context of the signed hash | the previous entry's hash, its number, the op, the actor, the verdict date, the payload's digest, its receipt's number and hash, and each deciding rule | `cella.verify_log` |
| session opening | a member's device, Ed25519 | `cella org 2026-10 session`, the message's first line | the scope, the actor, the device's key and the server's single-use challenge | the shell's server, `opens` in `lib/server/session.ts`, before it keeps a session |

### A write

The device signs this text, UTF-8, one `name value` line each, every line
ending in a newline:

```text
cella org 2026-10 write
scope lanterne.example
op invoice:invoice:issue
actor julien@lanterne.example
device <the device's public key, 64 lowercase hex digits>
request <SHA-256 of the canonical JSON of {"request": …, "salt": …}, 64 lowercase hex digits>
nonce <16 random bytes, 32 lowercase hex digits>
```

- **scope** is the scope's address, the `cella.scope` setting, so a
  signature verifies in no other scope.
- **request** is what the member asked for, the handler's input, not the
  payload the verdict commits to: the server fills the payload in (an
  invoice's number, a stance's receipt) after the member signed. Its
  canonical JSON has sorted keys, no whitespace and integers only; bytes
  travel as hex. It is hashed with a salt, 32 random bytes as hex that
  the device draws for each write and sends beside it, as
  `{"request": …, "salt": …}`. The notary keeps the digest in the
  receipt for everyone and the salt beside it for the owner alone: the
  digest hides what the member typed, so no one holding the log can
  confirm a guess of it, and the owner holding the salt can check later
  whether a request is what the member signed (`cella.signed(n,
  request)`). SHA-256 rather than BLAKE3, because browsers sign with
  WebCrypto, which has SHA-256 and no BLAKE3.
- **The payload restates the request** where it says the same thing:
  `submit` refuses a payload holding a field of the request with a
  value of the same JSON kind but another value, a personal value
  compared by the value it marks, so the log cannot say a member asked
  for what they did not sign. A value of another kind under the same
  name, such as the id of the file stored for the file sent, is the
  server's own.
- **nonce** makes the signature count once: the notary refuses a write
  whose device and nonce a receipt already holds. A refused write rolls
  back, so its nonce is not spent.
- No field may be empty or hold a control character, so no field can
  forge a line.

The signature is checked strictly (`verify_strict`): no weak keys and no
malleable signatures. `apps/org/core/sign/ts` builds and signs the message
in TypeScript; `cella_rules::sign` builds and checks it in Rust.

### A session's opening

A device signs in by signing this text, as a write's, one line each:

```text
cella org 2026-10 session
scope lanterne.example
actor julien@lanterne.example
device <the device's public key, 64 lowercase hex digits>
challenge <the server's challenge>
```

The challenge is the server's: when it expires, two minutes on, 16 random
bytes, and the server's HMAC-SHA256 over both under its session key, so
the server keeps nothing until it is answered. Answered, it is spent: one
signature opens one session. The server then checks the device is a
current key of the actor, as the keyring says, and keeps the session in a
cookie it MACs with the same key, naming the actor, the device and when
it ends, fourteen days on; every request checks again that the device is
current, so a revocation ends its sessions. A session lets its holder
read and ask for writes; it signs nothing, and each write is still signed
by the device, in the browser.

### A receipt and an entry

`submit` signs the receipt once the write's rules accept, then the entry,
which names the receipt by number and hash, so a verdict cannot be moved
to another receipt and a receipt cannot be moved to another write. The
receipt's time orders nothing; receipt numbers order stances.

## Digests

| Digest | Function | Tag | Over |
|---|---|---|---|
| payload | BLAKE3 derive-key | `cella org 2026-10 log payload` | the canonical JSON of the payload as the log keeps it, each personal value replaced by its commitment |
| request | SHA-256 | none: the write message's tag separates it | the canonical JSON of `{"request": …, "salt": …}`, a fresh salt each write |
| personal commitment | BLAKE3 derive-key | `cella org 2026-10 personal commitment` | a fresh 32-byte salt, then the value's canonical JSON; kept in the logged payload as `{"$commit": hex}` |
| rule text | BLAKE3 derive-key | `cella org 2026-10 rule text` | a rule's definition, as `pg_get_functiondef` gives it |
| invitation link | SHA-256 | none: it names a secret no other digest takes | the 32 random bytes an inviter's browser draws, which only the link holds; `membership.link` keeps the digest, and taking the invitation up shows the secret |
| content | BLAKE3, plain | none: it names content, as `b3sum` computes it | a document version's canonical form: its block tree as RFC 8785 JSON, computed from its Loro snapshot ([trust](trust.md#what-a-decision-adopts)) |

## Keys derived and sealed

| Key | Derived by | Tag | From |
|---|---|---|---|
| vault wrap key | BLAKE3 derive-key | `cella org 2026-10 vault key` | the vault's own 32 random bytes, `cella.vault_key_file`, apart from the notary's seed; it seals each vault key |
| vault key | 32 random bytes, Postgres's `pg_strong_random` | none | one per subject, retention class and year; seals that subject's values |

Both seal with XChaCha20-Poly1305 under a random 24-byte nonce, bound
as associated data to the row they sit in: a key to its subject, class
and year, a value to its commitment, subject, class, year and field, so
a sealed value moved to another row does not open.

## Keys that sign nothing real

Lanterne's fixture devices hold keys derived from their address and label
(`fixture` in `@cella/org-sign`, tagged `cella fixture device key,
test-only, never a member's`). Anyone can compute them; they exist so
that the seed and the tests hold the same keys, and are never enrolled
for a real member. The dev server's sign-in page offers the fixture
members, and the browser derives the key of the one picked and signs
with it as with any device; the server signs with none, in dev mode or
not.

## Not yet signed

- Confluent writes in signed batches, which come with the offline queue
  at rung 2; each write is signed and received on its own until then.
- Thresholds as signed policy, guardian shares and recovery are not built.
- At rung 5 a receipt or an entry shown to another scope will also name
  its audience.
