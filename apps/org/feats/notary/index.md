+++
title = "Notary"
updated = 2026-10-24
+++

The server's office for ordered writes. It signs a receipt when a write arrives, runs the rules that attach to it, then signs a numbered verdict; a verdict out of receipt order is proof against it. It never decides an outcome: an outcome is computed from the signed votes, and anyone holding the log can compute it again.

The notary is the `cella` Postgres extension, a package of org's core at `apps/org/core/notary/rs`, not yet built. A handler opens a transaction, calls `select cella.submit(…)`, writes the state on Settled and commits once, so each verdict commits with its state change. Only the extension's functions may write the log. If the pgrx spike fails, the notary is a module of the app with the same `submit(write) → verdict` interface inside the caller's transaction. The transaction and the rules are in [trust](../../../../_corpus/doc/trust.md).

This feat holds the notary's own writes.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/notary/move` | ordered | moving the co-op's notary to another server is an admin power |

Peers, other co-ops' notaries, arrive at rung 5 with federation, and their writes with them; at rung 6 they cosign log heads.
