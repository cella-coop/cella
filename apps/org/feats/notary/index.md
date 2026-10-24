+++
title = "Notary"
updated = 2026-10-24
+++

The server's office for ordered writes. It signs a receipt when a write arrives, checks the write's rule, then signs a numbered verdict; a verdict out of receipt order is proof against it. It is the one path that appends to the log, and it commits each verdict with its state change in one transaction. It never decides an outcome: an outcome is computed from the signed votes, and anyone holding the log can compute it again.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/notary/move` | ordered | moving the co-op's notary to another server is an admin power |

Peers, other co-ops' notaries, arrive at rung 5 with federation, and their writes with them; at rung 6 they cosign log heads.

## Roots

Its Rust root, which builds the notary's binary on org's `crypto`, `log` and `keystore`, comes later.
