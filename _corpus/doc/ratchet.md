+++
title = "Ratchet"
updated = 2026-10-24
+++

# Ratchet

Cella starts simple and only ever tightens. The first customers are small
co-ops of five to ten members, hosted by us, online and unfederated. Each
rung adds a guarantee without undoing the one before, towards full
decentralisation and zero trust.

| Rung | Adds | Guarantees |
|---|---|---|
| 1 · Pilot | hosted, online; double-entry books; an audit log; democratic roles; members sign on their devices | every decision traces to who signed it; nobody rewrites history quietly; outsiders cannot forge a vote |
| 2 · Offline | queued confluent writes, budget shares and device series; rules for late writes | members keep working without signal |
| 3 · Books of record | VAT, statutory exports such as France's FEC, e-invoicing through an approved platform | cella replaces the accounting tool instead of feeding it |
| 4 · Native client | signing in an app the host does not serve | the host cannot forge a vote |
| 5 · Federation | signed events between co-ops, sign-in across servers, joint scopes | co-ops can trust each other's records |
| 6 · Witnesses | peers cosign log heads; a co-op can move host without losing a write | no single host can rewrite a log or hold a co-op hostage |
| 7 · Local-first | clients take over the confluent and bounded writes | zero trust: the server becomes one more peer |

## The pawls

A rung holds only if the design keeps the catches later rungs need. They
cost little now and a rewrite later, so rung 1 keeps all of them:

- a label on every write, in the type;
- a hash-chained audit log of every accepted write, with a deterministic fold;
- member device keys;
- personal data out of the log, behind single-use salted commitments;
- double-entry books;
- stable addresses and a server key per scope;
- rules as primitives in a pure Rust crate behind one declared SQL surface,
  composed in a declared SQL subset, each rule's text and version in the log,
  and a conformance suite any engine can run ([trust](trust.md#rules)).

## Rung 1

Each feat's `feat.toml` names its rung. The pilot runs one write of each kind
end to end: edit a document together (confluent), issue an invoice numbered
by the server (bounded; device series wait for rung 2), and admit a member by
vote (ordered).

Not in the pilot: the offline queue, statutory exports, the native client,
federation, Merkle proofs for peers and end-to-end encryption.

## Moving a notary

The notary is the scope's database, so moving it is moving the database to
another host: state, log, rules and the scope's key together. It arrives
at rung 6, when peers cosign log heads and a move can be shown to lose no
write. Its governance write, the scope's decision to move, belongs to the
feat that holds the scope's hosts and peers, which arrives with
federation at rung 5; until then the host moves a database as an operator,
outside the log.
