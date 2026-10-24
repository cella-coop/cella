+++
title = "Trust"
updated = 2026-10-24
+++

# Trust

Each scope — a co-op, a joint circle of co-ops, or a federation — runs its
own server, with its own Postgres database, log and notary. Every piece of
data has exactly one owning scope; anything shared gets a scope of its own.
There is no consensus between servers and nothing to resolve: other scopes
keep signed copies of what concerns them.

## Three kinds of write

| Label | Path | Examples |
|---|---|---|
| confluent | merges in any order; never waits | edits, comments, votes cast, deposits, time entries |
| bounded | spends a right granted in advance; waits only when the right runs out | budget shares, invoice series, draws |
| ordered | waits for the notary's verdict, and shows Pending until it comes | admissions, adoptions, voids, closing a period |

Until rung 2 every write goes through the server. The label is in the type
from the start, so that later rungs move confluent and bounded writes to the
clients without a rewrite. On the server a confluent or bounded write still
meets its feat's triggers and rules, so its outcome may be `Refused` as well
as `Settled`; only an ordered write may also be `Pending`.

## One server

The notary lives inside Postgres as the `cella` extension, built with pgrx
on the pure Rust rules crate (`apps/org/core/notary/rs` over
`apps/org/core/rules/rs`). The pgrx
spike (`research/pgrx/`) showed it builds on NixOS against Postgres 18,
holds one transaction from Node, and keeps a gapless signed log the app's
role cannot write. Installing it needs a superuser, so a scope runs on a
Postgres we operate, never a managed service.

```mermaid
sequenceDiagram
  participant D as Member's device
  participant A as App handler (TypeScript)
  participant N as cella extension
  participant P as Feat schemas
  D->>A: request, signed
  A->>A: permission check
  rect rgba(128, 128, 128, 0.15)
    A->>P: begin; state change
    A->>N: select cella.submit(op, payload, actor, signed request)
    N->>N: signature, device and nonce checked; rules; receipt and verdict signed and appended
    N-->>A: verdict, or a refusal raised
    A->>P: commit if Settled, roll back if Refused
  end
  A-->>D: Settled or Refused
```

- **The member signs every write on their device** (WebCrypto Ed25519):
  a domain-separated message naming the scope, the op, the actor, the
  device, the digest of the request and a single-use nonce
  ([signatures](signatures.md)). `submit` checks it before any rule runs:
  the signature, then, under the log's head lock, that the device is a
  current key of the actor (the keyring, the `key` feat's) and that its
  nonce was never counted. A forged signature, a revoked or another
  member's device, a reused nonce or a request swapped under a valid
  signature is refused, and no verdict number is used.
- **Only the extension's functions may write the log.** No client, script or
  psql session can append to it any other way. Each settled write has one
  receipt, numbered as it arrives, which the notary signs with the member's
  signature and the payload's digest in it; the numbered verdict names
  that receipt by number and hash. Verdicts follow commit order and
  receipts arrival order, so two concurrent writes may settle in the other
  order; what is ordered by receipt (stances, cutoffs) reads the receipt.
  The notary never decides an outcome: an outcome is computed from the
  signed votes, and anyone holding the log can compute it again.
- **The verdict and its state change commit in one transaction.** The
  handler opens it, writes the state, calls `cella.submit` last and commits
  once. A refusal raises inside `submit` (SQLSTATE `09000`), so the
  transaction cannot commit it: both roll back and no number is used.
  `submit` holds the log's head lock until
  commit, so calling it last keeps ordered writes from queueing behind slow
  transactions. Entries are numbered from that locked head, so an aborted
  write leaves no gap. The log is hash-chained (BLAKE3) and signed
  (Ed25519) with a deterministic fold, so the state can always be rebuilt
  from it and checked. A Merkle tree over the log (RFC 9162) gives
  inclusion and consistency proofs.
- **Order comes from receipts, never from clocks.** A member's latest stance
  is the one with the highest receipt number, not the latest date.
- **The scope's key** is read from a file only the database's superuser can
  read; the scope's address, which every write signature names, is the
  `cella.scope` setting.
- **A fault in the extension stays bounded.** A Rust panic becomes an
  ordinary error that aborts the transaction. A hard crash makes Postgres
  restart every connection in the scope, in about 0.2 s, and lose nothing
  committed.
- **A scope's database is the unit** that moves, backs up and replays: state,
  log, rules and the notary's key together. The notary is a layer under
  every feat, not a feat, and has no writes of its own; moving it is moving
  the database to another host, which arrives at rung 6
  ([ratchet](ratchet.md#moving-a-notary)).
- **Who may write is a rule like any other.** Each op that needs a power
  names it in `cella.power`, registered by its feat; the `circle-member`
  graft attaches a rule to every such op that the actor holds, on the
  verdict date, a seat whose role has a mandate granting the power, within
  its limit for the write's amount. A write with no power is the actor's
  own (a profile, a device), a member's of a roll or a circle (a stance,
  a proposal, a close) or decided (an admission, an adoption, a seat):
  its label declares that check and a rule enforces it, and `cella check
  feats` refuses an op that names neither, so nothing is allowed by
  omission. Money leaves a cash account only through writes with their
  own power and limit (`transaction.pay`, `transaction.payroll`).
- **Confluent writes are logged in signed batches** once devices queue
  them offline (rung 2); until then each goes through the server's rules
  on its own.

## Rules

The extension is cella core's semantics exposed as SQL, wrapping the Rust
rules crate, which also compiles to WASM for browsers, devices and auditors:

- types: `cella.amount`, positive cents; balances are signed and derived;
- aggregates: `cella.consent`, `cella.majority`, …; an outcome is folded from
  the votes, never stored;
- the write being judged: `cella.op()`, `cella.actor()`, `cella.device()`;
  whether the actor may use a power is not a primitive but the
  `circle-member` graft's composed rule, `circle_member.may(actor, power,
  cents, day)`, since only that graft sees both mandates and seats;
- trigger functions that feats and grafts attach: entries balance, periods
  are open;
- time: `cella.verdict_date()`, never `now()`;
- the notary: `cella.submit`, log verification, proofs.

Rules come in four layers:

| Layer | Who changes it | Written as |
|---|---|---|
| Primitives | us, by release | Rust: the `cella.*` types, aggregates and functions |
| Composed rules | power users and module developers, adopted by decision | `LANGUAGE sql` functions over the primitives, in the declared subset |
| Parameters | circles and the assembly | rows: mandates, limits, the procedure each circle uses |
| Members' view | members | forms that read back as sentences |

The law for each legal form is ours to write, as primitives and composed
rules. A co-op's own rules live in custom feats, each with its own schema,
enabled by decision.

Composed rules are a declared subset of SQL: `SELECT`, joins over the
scope's tables, `FILTER`, a closed list of aggregates and the `cella.*`
primitives; no `now()` or `random()`, no recursion, no DDL, no writes. Each
rule is written as a `BEGIN ATOMIC` body and checked twice when it is
adopted: its parse tree against the subset (libpg_query), and its resolved
dependencies against Postgres's catalogue, which sees the casts and
operators the parser cannot. A rule outside the subset is refused. A statement timeout bounds evaluation. The log records
the text and version of every rule that decided a verdict.

A rule runs as `cella_rules`, never with the extension owner's rights:
`submit` switches to that role in a security-restricted operation around
each rule, as Postgres does for a security-definer function. The role
reads only what each feat and graft grants it, its own schema, and can
write nothing, take no receipt, call no `submit`, and read neither the key
file nor its setting. A rule declared `SECURITY DEFINER` is refused.

SQL is the source of truth for rules. The browser may preview a rule
through the WASM primitives but never re-implements one in TypeScript.

PGlite, Postgres compiled to WASM, cannot load a pgrx extension. On a device
the primitives first run beside it, as WASM in JavaScript, and composed rules
wait. To bring them onto devices, the same pure crate is compiled for
PGlite's toolchain and wrapped in a thin C binding that registers the same
`cella.*` surface; that binding is research for rung 7.

Five catches keep local-first (rung 7) open, so that composed rules can run
without the server's Postgres on a later runtime:

- the declared subset;
- the primitives in a pure Rust crate with no pgrx in it, so devices get
  them as WASM;
- the extension's SQL surface declared in one place: a fixed list of types,
  functions, aggregates and operators, each a thin wrapper over the crate
  with no logic of its own, so a second binding only wraps the list;
- each rule's text and version in the log;
- a conformance suite, Lanterne's cases and their expected verdicts,
  runnable against any engine: Postgres, PGlite, or a future runtime.

Until the native client (rung 4) the host serves the signing code. The pilot
guards against outsiders and later tampering, not against the host, and
makes no claim that the host cannot forge a vote.

## Keys and addresses

- Members have device keys from day one. A key is enrolled by the member's
  current key; rotating keys keeps the address. A member's first device
  comes with their invitation (not built: until then the seed enrols it).
  Enrolment and revocation are ordered, and the keyring is read under the
  log's head lock, so a revocation that settled first is always seen.
- Each scope has a server key and stable addresses (`ana@coop-a`), so
  federation adds to the design rather than changing it.
- Signatures are Ed25519, on devices and at the root, where the notary
  signs receipts and log entries with the scope's key. Org's `core/crypto`
  holds ML-DSA-44 behind the same signing seam, and hybrid X25519 +
  ML-KEM-768 encryption; no rung adopts post-quantum signing yet.
- Every signed artifact names its binding (parent, sequence, audience or
  freshness), and each signed type is domain-separated; the register of
  signed types, their tags and bindings is [signatures](signatures.md).
- Thresholds are signed policy in the log, never flags or unsigned config.
  No one holds a group's key alone.
- Lost keys are recovered from guardian shares.

## What a decision adopts

A decision that adopts a document names its content, not a row: the
BLAKE3 of the version's canonical form, which anyone holding the version
can compute again without cella. A document is a Loro tree of blocks; its
canonical form is that tree as JSON per RFC 8785 (JCS): the blocks in
reading order, each with its type, the props its type keeps, its text as
runs with their marks, and its children, block ids left out, so documents
that read the same hash the same however they were made. Numbers are
safe integers; a document holding anything else has no canonical form
and cannot be saved as a version.

The database computes it, from the Loro snapshot a version keeps, in the
`cella` extension (`cella.document_canonical`, `cella.document_hash`, on
the `loro` crate pinned to the browser's `loro-crdt`); the server never
takes a hash from a client. The browser computes the same bytes to
preview the hash while members edit, and the document feat's tests hold
the two to the same bytes. An adoption's log entry commits to the hash,
and `decision-document`'s rule refuses to adopt a version that hashes
otherwise than the decision names.

## Personal data

Personal data stays out of the log. Each entry holds commitments, each with
a fresh salt; the data and its salt sit in a vault, encrypted per member,
retention class and year. Erasure deletes the row and its salt, destroys the
keys that expired, and writes an erasure entry; the log still verifies and
folds the gap to `redacted`. Books and payroll are restricted rather than
erased until their legal clock runs out.

## Current limits

What the build does not yet do, and what lifts each:

- **The host serves the signing code and relays requests.** A reaction the
  server runs on a member's behalf, such as admitting on a passing close,
  is signed with that member's signer as the handler's caller hands it;
  until the native client (rung 4) nothing stops a host signing with keys
  it serves.
- **The shell's server signs for the member in dev mode.** No device
  signs in the browser yet, and the server has no sessions. `cella
  serve` runs it in dev mode, where it signs a write as the member picked
  in the user menu with that member's TEST-ONLY fixture key, which anyone
  can derive, and only a key enrolled under that device's label. Outside
  dev mode it signs for no one and every write fails before a verdict.
  Signing in the browser with `@cella/org-sign`, which runs on WebCrypto,
  lifts this.
- **A mandate's budget is not enforced.** A power's limit per write is
  checked; a budget, a total over a month or a year, needs the spend it
  caps tracked, which comes with `account.draw`.
- **Confluent writes are single-entry log entries, not batches.** Each
  confluent write is submitted on its own and takes its own signed entry.
  Signed batches come with the offline queue at rung 2, which syncs a
  device's confluent writes together.
- **Payload and request digests are not yet salted.** An entry holds the
  BLAKE3 digest of its canonical payload, and a receipt the SHA-256 of the
  request the member signed, so either can be confirmed against the log
  by anyone who guesses it. Handlers keep personal data out of payloads
  (an invoice's name billed, a void's reason, a client's field values),
  but a request carries what the member typed. Salted commitments with
  the vault lift this before the pilot holds real members' data, in rung
  1's personal-data increment.
- **Entries balance and periods are open by triggers in their owners'
  schemas**, PL/pgSQL in `transaction` and `account_transaction`, not yet
  `cella.*` trigger functions.

## Open

- Whether personal data enters the log only for ordered writes.
- The late-write rules for offline writes (rung 2).
