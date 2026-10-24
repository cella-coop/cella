+++
title = "Notary"
updated = 2026-10-24
+++

The server's office for ordered writes. It signs a receipt when a write arrives, runs the rules that attach to it, then signs a numbered verdict; a verdict out of receipt order is proof against it. It never decides an outcome: an outcome is computed from the signed votes, and anyone holding the log can compute it again.

The notary is the `cella` Postgres extension, a package of org's core at `apps/org/core/notary/rs`, not yet built. A handler opens a transaction, writes the state, calls `select cella.submit(…)` last and commits once, so each verdict commits with its state change; a refusal rolls both back. Only the extension's functions may write the log. The transaction and the rules are in [trust](../../../../_corpus/doc/trust.md).

This feat holds the notary's own writes.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/notary/move` | ordered | moving the co-op's notary to another server is an admin power |

Peers, other co-ops' notaries, arrive at rung 5 with federation, and their writes with them; at rung 6 they cosign log heads.
