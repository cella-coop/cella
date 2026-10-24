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
clients without a rewrite.

## One server

The notary lives inside Postgres as the `cella` extension, built with pgrx
on the Rust rules crate (`apps/org/core/notary/rs`, not yet built). A pgrx
spike is settling whether it builds and behaves; if it fails, the notary is
a module of the app with the same `submit(write) → verdict` interface,
inside the caller's transaction, and no feat changes.

```mermaid
sequenceDiagram
  participant D as Member's device
  participant A as App handler (TypeScript)
  participant N as cella extension
  participant P as Feat schemas
  D->>A: signed write
  A->>A: permission check
  rect rgba(128, 128, 128, 0.15)
    A->>N: begin; select cella.submit(write)
    N->>N: receipt, rules, verdict appended to the log
    N-->>A: verdict
    A->>P: state change, if Settled
    A->>P: commit
  end
  A-->>D: Settled or Refused
```

- **The member signs on their device** (WebCrypto Ed25519). Votes and
  approvals carry the member's own signature, and the governed record cites
  them.
- **Only the extension's functions may write the log.** No client, script or
  psql session can append to it any other way. The notary signs a receipt
  when a write arrives, then a numbered verdict; a verdict out of receipt
  order is proof against it. It never decides an outcome: an outcome is
  computed from the signed votes, and anyone holding the log can compute it
  again.
- **The verdict and its state change commit in one transaction.** The
  handler opens it, calls `cella.submit`, writes the state on Settled, and
  commits once. The log is hash-chained with a deterministic fold, so the
  state can always be rebuilt from it and checked. A Merkle tree over the
  log (RFC 9162) gives inclusion and consistency proofs.
- **A scope's database is the unit** that moves, backs up and replays: state,
  log, rules and the notary's key together.
- **Confluent writes skip the rule check** and are logged in signed batches.

## Rules

The extension is cella core's semantics exposed as SQL, wrapping the Rust
rules crate, which also compiles to WASM for browsers, devices and auditors:

- types: `cella.amount`, positive cents; balances are signed and derived;
- aggregates: `cella.consent`, `cella.majority`, …; an outcome is folded from
  the votes, never stored;
- policy functions: `cella.may(actor, power, amount)` reads mandates as rows;
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
rules. A co-op's own composed rules are documents adopted by decision.

Composed rules are a declared subset of SQL: `SELECT`, joins over the
scope's tables, `FILTER`, a closed list of aggregates and the `cella.*`
primitives; no `now()` or `random()`, no recursion, no DDL, no writes. Each
rule is checked against the subset with libpg_query when it is adopted, and
refused outside it. A statement timeout bounds evaluation. The log records
the text and version of every rule that decided a verdict.

SQL is the source of truth for rules. The browser may preview a rule
through the WASM primitives but never re-implements one in TypeScript.

Four catches keep local-first (rung 7) open, so that composed rules can run
without Postgres on a later runtime:

- the declared subset;
- the primitives in a Rust crate, so devices get them as WASM;
- each rule's text and version in the log;
- a conformance suite, Lanterne's cases and their expected verdicts,
  runnable against any engine: Postgres, PGlite, or a future runtime.

Until the native client (rung 4) the host serves the signing code. The pilot
guards against outsiders and later tampering, not against the host, and
makes no claim that the host cannot forge a vote.

## Keys and addresses

- Members have device keys from day one. A key is enrolled by the member's
  current key; rotating keys keeps the address.
- Each scope has a server key and stable addresses (`ana@coop-a`), so
  federation adds to the design rather than changing it.
- Signatures are Ed25519 on devices and ML-DSA-44 at the root; encryption is
  hybrid X25519 + ML-KEM-768 (org's `core/crypto`).
- Every signed artifact names its binding (parent, sequence, audience or
  freshness), and each signed type is domain-separated.
- Thresholds are signed policy in the log, never flags or unsigned config.
  No one holds a group's key alone.
- Lost keys are recovered from guardian shares.

## Personal data

Personal data stays out of the log. Each entry holds commitments, each with
a fresh salt; the data and its salt sit in a vault, encrypted per member,
retention class and year. Erasure deletes the row and its salt, destroys the
keys that expired, and writes an erasure entry; the log still verifies and
folds the gap to `redacted`. Books and payroll are restricted rather than
erased until their legal clock runs out.

## Open

- The pgrx spike's outcome, and with it whether the notary is the extension
  or the fallback module.
- Whether personal data enters the log only for ordered writes.
- The late-write rules for offline writes (rung 2).
