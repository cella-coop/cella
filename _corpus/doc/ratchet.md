+++
title = "Ratchet"
updated = 2026-11-14
+++

# Ratchet

Cella starts simple and only ever tightens. The first customers are small
co-ops of five to ten members, hosted by us, online and unfederated. Each
rung adds a guarantee without undoing the one before, towards full
decentralisation and zero trust.

| Rung | Adds | Guarantees |
|---|---|---|
| 1 · Pilot | hosted, online; double-entry books; an audit log; democratic roles; members sign on their devices | every decision traces to who signed it; nobody rewrites history quietly; outsiders cannot forge a vote |
| 2 · Offline | queued confluent writes, budget shares and device series; guards for late writes | members keep working without signal |
| 3 · Books of record | VAT, statutory exports such as France's FEC, e-invoicing through an approved platform | cella replaces the accounting tool instead of feeding it |
| 4 · Native client | signing in an app the host does not serve | the host cannot forge a vote |
| 5 · Federation | signed events between co-ops, sign-in across servers, joint scopes | co-ops can trust each other's records |
| 6 · Witnesses | peers cosign log heads; a co-op can move host without losing a write | no single host can rewrite a log or hold a co-op hostage |
| 7 · Local-first | clients take over the confluent and bounded writes | zero trust: the server becomes one more peer |

## The pawls

A rung holds only if the design keeps the catches later rungs need. They
cost little now and a rewrite later, so rung 1 keeps all of them:

- a label on every write, in the type;
- a hash-chained audit log of every accepted write, with a deterministic fold:
  the log folded into an empty database rebuilds the scope's non-personal
  state exactly, in memory its length never grows, each action's fold
  versioned as a guard is, and from a checkpoint's state hash as well as
  from the first entry; a test folds Lanterne's year to prove it, and a
  generated scope of ten million entries to prove it scales, which a run
  on the box did on 14 Nov 2026 ([tests](architecture.md#tests))
  ([trust](trust.md#one-server));
- member device keys;
- personal data out of the log, behind single-use salted commitments;
- double-entry books;
- stable addresses and a server key per scope;
- guards as primitives in a pure Rust crate behind one declared SQL surface,
  composed in a declared SQL subset, each guard's text and version in the log,
  and a conformance suite any engine can run ([trust](trust.md#guards)).

## Rung 1

Each feat's `feat.toml` names its rung. The pilot runs one write of each kind
end to end: edit a document together (confluent), issue an invoice numbered
by the server (bounded; device series wait for rung 2), and admit a member by
vote (ordered).

Not in the pilot: the offline queue, statutory exports, the native client,
federation, Merkle proofs for peers and end-to-end encryption. Nor is
folding confluent writes in parallel, which their labels allow, or
witnesses; nothing the fold builds now precludes any of them: a scope
grows to tens of thousands of members over decades, about ten million
entries, and a federation grows by adding scopes.

## Moving a notary

The notary is the scope's database, so moving it is moving the database to
another host: state, log, guards and the scope's key together. It arrives
at rung 6, when peers cosign log heads and a move can be shown to lose no
write. Its governance write, the scope's decision to move, belongs to the
feat that holds the scope's hosts and peers, which arrives with
federation at rung 5; until then the host moves a database as an operator,
outside the log.
