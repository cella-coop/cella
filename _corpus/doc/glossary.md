+++
title = "Glossary"
updated = 2026-10-24
+++

# Glossary

## Cella

| Term | Meaning |
|---|---|
| **app** | a root feat of the repository; `org` is the ERP |
| **feat** | a collection of things and the code that keeps it, named for the collection: `member`, `invoice`; imports no other feat |
| **graft** | a relationship between feats: its junction, model and handlers, named by the feats it joins in alphabetical order (`client-invoice`) |
| **slice** | a feat or a graft, either one |
| **slice test** | a test of exactly one slice, in its package's `_tests/`, run by `cella test slice` on a database holding only that slice's part of the tree |
| **e2e test** | a scenario across slices, in an app root's `_e2e/`, run by `cella test e2e` on a seeded mock co-op |
| **increment** | a chunk of build work; never a slice |
| **shell** | the org app's SvelteKit root, `apps/org/ts`, which mounts every slice's collections and pages; it holds the routes and no feature of its own |
| **collection** | what a feat holds, as the shell lists it, one route each (`/invoices`); a graft extends the collections of the feats it joins |
| **state class** | a client's state, `hooks/<Name>State.svelte.ts`, reached through its `use<Name>` hook from context; components hold none of their own |
| **core** | a node's shared libraries, inherited by its feats and grafts; org's core holds `ops`, `crypto`, `log`, `keystore`, `db`, `sign`, `ui` and the notary |
| **custom feat** | a co-op's own feat with its own schema, enabled by decision: how cella is extended |
| **subsidiarity** | a rule lives at the lowest level that owns it: a feat, a graft, or a core |
| **scope** | the unit of ownership: a co-op, a joint circle of co-ops or a federation, with its own server, database, log and notary |
| **address** | a member's stable name in a scope, `ana@coop-a`; keys rotate under it |
| **device key** | an Ed25519 key on a member's device that signs their writes |
| **guardian** | a person holding a share of a member's recovery secret |
| **label** | how a write contends: confluent, bounded or ordered; part of its type |
| **confluent** | a write that merges in any order and never waits: an edit, a vote cast, a payment |
| **bounded** | a write that spends a right granted in advance and waits only when the right runs out: a draw, an invoice number |
| **ordered** | a write that waits for the notary's verdict and shows Pending until it comes: an admission, an adoption, a close |
| **share** | a right granted in advance that bounded writes spend: a budget, a block of numbers |
| **series** | an invoice numbering sequence; the server's at rung 1, a device's own at rung 2 |
| **notary** | the scope's office for every write: the `cella` Postgres extension, a layer of org's core under every feat, not a feat; it alone writes the log |
| **receipt** | the notary's signed, numbered acknowledgement that a write arrived, carrying the member's signature on it; one per write; order comes from receipts, never from clocks |
| **nonce** | the single-use random value in a write's signature, so the signature counts once |
| **keyring** | the one function that says whether a device is a current key of an address: the `key` feat's, called by the notary before any rule |
| **verdict** | the notary's signed ruling on an ordered write, Settled or Refused, committed with its state change |
| **log** | the scope's hash-chained, signed record of every accepted write, from which the state folds |
| **fold** | rebuilding state, or an outcome, deterministically from the log |
| **primitive** | a `cella.*` type, aggregate or function, written in Rust and released by us |
| **composed rule** | a `LANGUAGE sql` function over the primitives, in the declared subset, adopted by decision |
| **power** | the id of something a write needs, such as `issue-invoice`; each op's is registered in `cella.power` |
| **mandate** | a grant of one power to one role, with an optional limit and term |
| **role** | a named duty in a circle that mandates attach to: gérante, finance, lead, secretary |
| **position** | a member holding a seat, and perhaps a role, in a circle |
| **circle** | a self-governing unit of the co-op; circles nest in one tree |
| **rung** | a step of the ratchet, from the hosted pilot to zero trust |
| **vault** | where personal data and its salts live, outside the log, so erasure leaves the log verifiable |

## Co-ops

| Term | Meaning |
|---|---|
| **assembly** | the general assembly: every member, with authority over statutes, admissions, accounts and the surplus |
| **SCOP** | société coopérative et participative: France's worker co-op, a SARL or SA whose workers hold the majority of capital and votes |
| **SCIC** | société coopérative d'intérêt collectif: France's multi-stakeholder co-op, its members in colleges |
| **gérant(e)** | the elected manager and legal representative of a SCOP SARL |
| **college** | a class of members in a multi-stakeholder co-op, with its own weight in votes |
| **surplus** | what remains of a year's income after expenses; a co-op's profit |
| **work share** | the part of the surplus paid to the workers for their work (participation) |
| **indivisible reserves** | surplus kept by the co-op for good, never distributed |
| **interest on capital** | the part of the surplus paid on members' capital shares, capped by law |
| **capital account** | a member's equity in the co-op: subscribed shares and what is credited to them |
| **patronage** | a member's contribution (hours, wages, revenue or trade) used to divide a surplus |
| **buy-in / buyout** | capital a member subscribes on joining, and its repayment on leaving |
| **revolving capital** | repaying the oldest retained patronage as new patronage is retained |
| **dues** | periodic payments every member owes |
| **period** | a month of the books; closed once its entries are final |
| **solidarity rate** | Lanterne's lower day rate for associations and small co-ops |

## Deciding

| Term | Meaning |
|---|---|
| **proposal** | a decision put to a circle, with its rule and deadline |
| **consent** | passes if no one objects at close; a member's latest stance counts |
| **objection** | a stance under consent that blocks while it stands |
| **stand aside** | disagreement recorded without blocking |
| **consensus** | everyone actively agrees; stricter than consent |
| **majority** | passes with more for than against among those voting; a supermajority raises the threshold |
| **quorum** | the participation a decision needs to count; a meeting's, the share of its circle's seats present |
| **agenda** | a meeting's items in order, each tabling perhaps a decision; fixed once the meeting is held |
| **minutes** | a meeting's record, a document, adopted by decision where its circle says so |
| **roll** | who may vote on a decision |
| **delegate** | a member chosen to vote for others at a higher level |
| **adoption** | a decision making one version of a document binding |
| **outcome** | the result of a decision, folded from its signed votes, never stored |
| **open · passed · rejected** | a decision's state: open until its close, then passed or rejected by the outcome of the stances the close froze, read in SQL; "adopted" is a document version's, never a decision's |
