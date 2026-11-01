+++
title = "Glossary"
updated = 2026-11-01
+++

# Glossary

## Cella

| Term | Meaning |
|---|---|
| **app** | a root feat of the repository; `org` is the cooperative workspace |
| **cooperative workspace** | what cella is: the one place a member-governed organisation keeps its books, its work, its decisions and its members, on a server of its own (single-tenant) that federates with other scopes' servers by signed events; never called an ERP |
| **feat** | a collection of things and the code that keeps it, named for the collection: `person`, `invoice`; imports no other feat; a feat may hold feats of its own, which inherit its core (**nested feat**) |
| **graft** | a relationship between feats: its junction, model and handlers, named by the feats it joins in alphabetical order (`client-invoice`), at the lowest node that holds them all |
| **slice** | a feat or a graft, either one |
| **slice test** | a test of exactly one slice, in its package's `_tests/`, run by `cella test slice` on a database holding only that slice's part of the tree |
| **e2e test** | a scenario across slices, in an app root's `_e2e/`, run by `cella test e2e` on a seeded mock co-op |
| **analytical contract** | a slice's `sql/analytics.sql`: the views it agrees to share with the analytics shell, which reads them as `cella_analytics`, the role granted those views and nothing else |
| **analytics shell** | the DuckDB 2.0 server per scope that attaches its database read-only as `cella_analytics`, serves it on localhost behind a token, and runs every report; `cella analytics` runs it |
| **analytics port** | `core/analytics`: a report definition checked against the views the slices publish, and the shell's implementation of it, which runs each report on one snapshot stamped with the log's head |
| **increment** | a chunk of build work; never a slice |
| **shell** | the org app's SvelteKit root, `apps/org/ts`, which mounts every slice's collections and pages; it holds the routes and no feature of its own |
| **inbox** | what waits on the acting person, each ask linking to where it is done: stances, approvals, an invitation, meetings to answer, mentions |
| **home** | the co-op's dashboard, widgets pinned from many collections |
| **pin** | a widget on the home: a standard widget and the collection it runs over |
| **collection** | what a feat holds, as the shell lists it, one route each (`/invoices`); a graft extends the collections of the feats it joins |
| **state class** | a client's state, `hooks/<Name>State.svelte.ts`, reached through its `use<Name>` hook from context; components hold none of their own |
| **core** | a node's shared libraries, inherited by its feats and grafts; org's core holds `ops`, `crypto`, `log`, `keystore`, `db`, `sign`, `guards`, `ui` and the notary |
| **custom feat** | a co-op's own feat with its own schema, enabled by decision: how cella is extended |
| **subsidiarity** | a guard lives at the lowest level that owns it: a feat, a graft, or a core |
| **scope** | the unit of ownership: a co-op, a joint circle of co-ops or a federation, with its own server, database, log and notary |
| **address** | a person's stable name in a scope, `ana@coop-a`; keys rotate under it |
| **device key** | an Ed25519 key on a person's device that signs their writes |
| **guardian** | a person holding a share of another's recovery secret |
| **label** | how a write contends: confluent, bounded or ordered; part of its type |
| **confluent** | a write that merges in any order and never waits: an edit, a vote cast, a payment |
| **bounded** | a write that spends a right granted in advance and waits only when the right runs out: a draw, an invoice number |
| **ordered** | a write that waits for the notary's verdict and shows Pending until it comes: an admission, an adoption, a close |
| **share** | a right granted in advance that bounded writes spend: a budget, a block of numbers, a draw limit |
| **series** | an invoice numbering sequence; the server's at rung 1, a device's own at rung 2 |
| **notary** | the scope's office every write passes through: it runs the guards and alone writes the log; software with no legal force; the `cella` Postgres extension, a layer of org's core under every feat, not a feat |
| **guard** | a check the notary runs on a write before it takes effect: does the actor hold a mandate, does the write follow the rules, was the decision it cites taken properly, is it sound in itself (a closed month, not one's own approval); SQL in its owner's schema, registered in `cella.guard`, run as `cella_guards` |
| **receipt** | the notary's signed, numbered acknowledgement that a write arrived, carrying the member's signature on it; one per write; order comes from receipts, never from clocks |
| **nonce** | the single-use random value in a write's signature, so the signature counts once |
| **keyring** | the one function that says whether a device is a current key of an address: the `person` feat's, called by the notary before any guard |
| **verdict** | the notary's signed ruling on an ordered write, Settled or Refused, committed with its state change |
| **log** | the scope's hash-chained, signed record of every accepted write, from which the state folds |
| **fold** | rebuilding state, or an outcome, deterministically from the log |
| **primitive** | a `cella.*` type, aggregate or function, written in Rust and released by us |
| **composed guard** | a `LANGUAGE sql` function over the primitives, in the declared subset, adopted by decision |
| **power** | the id of something a write needs, such as `issue-invoice`; each op's is registered in `cella.power` |
| **mandate** | a grant of one power to one role, with an optional limit per write or budget per month or year, and a term |
| **role** | a named duty in a circle that mandates attach to: gérante, finance, lead, secretary |
| **position** | a member holding a seat, and perhaps a role, in a circle |
| **circle** | a self-governing unit of the co-op; circles nest in one tree |
| **rung** | a step of the ratchet, from the hosted pilot to zero trust |
| **vault** | where personal data and its salts live, outside the log, so erasure leaves the log verifiable |
| **commitment** | what the log keeps of a personal value: the BLAKE3, under its own domain, of a fresh salt and the value, which opens only while the vault holds both |
| **retention class** | how long the law keeps a kind of personal data: `profile`, a person's name and records, and `contact`, erased when asked; `payroll`, five years; `expense-receipt` and `books`, ten |
| **erasure** | an ordered write that deletes a subject's salts, values and keys, redacts their columns and refuses any later value of the class; a restricted class waits for its clock |
| **restricted** | personal data the law keeps, which erasure leaves in place, unread, until the sweep finds its clock out |
| **file** | bytes the co-op keeps, named by their BLAKE3, which the database computes and the log commits to: its own papers, receipts, employment and member records; a personal file has a retention class and a subject |
| **receipt (file)** | a file attached to an expense, of class `expense-receipt`; not the notary's receipt |
| **import** | a file from another tool brought in through the normal signed writes, each record one write as the importing member, judged by the guards; recorded with what each line came to |
| **dry run** | an import whose writes are each made and rolled back, saying what would be created and what refused |
| **FEC** | the fichier des écritures comptables every French accounting tool exports (LPF art. A47 A-1); its entries are carried over into the journal |
| **carry** | posting an entry from the books of the co-op's last tool, which may open accounts and touch cash, under its own power |

## Co-ops

| Term | Meaning |
|---|---|
| **assembly** | the general assembly: every member, with authority over statutes, admissions, accounts and the surplus |
| **SCOP** | société coopérative et participative: France's worker co-op, a SARL or SA whose workers hold the majority of capital and votes |
| **SCIC** | société coopérative d'intérêt collectif: France's multi-stakeholder co-op, its members in colleges |
| **gérant(e)** | the elected manager and legal representative of a SCOP SARL |
| **person** | someone the co-op knows, by their address, with their name and devices, whatever they hold; a member if they hold a membership, a worker if they hold an employment, roles derived and never stored |
| **membership** | a person's belonging to the co-op, invited to exited, with the shares they hold; the feat nested in `person` that keeps it |
| **employment** | a person's contract with the co-op, member or not; the feat nested in `person` that keeps it |
| **worker** | a person who holds an employment, under a contract that runs from a first day to a last; their time and pay rest on their employment |
| **candidate** | a worker serving a probation before the assembly may admit them, pledging the shares they will subscribe |
| **probation** | the six months to a year a candidate works before the assembly votes on their admission; served in employment, kept with the candidacy |
| **joining** | what membership asks of a new member, step by step: admitted, the texts read, the capital subscribed, a device enrolled, the circles joined |
| **college** | a class of members in a multi-stakeholder co-op, with its own weight in votes |
| **surplus** | what remains of a year's income after expenses; a co-op's profit |
| **work share** | the part of the surplus paid to the workers for their work (participation) |
| **distribution** | a year's surplus shared out: its split, drafted, approved by the assembly, which fixes each worker's part, and then distributed, posted and its shares credited; the patronage feat's |
| **patronage terms** | the statutes' rule for each year's work share: how it divides among the workers, by pay, time worked, equal parts or a mix, and what part of an associate's part buys shares |
| **capital terms** | the statutes' capital clauses: a share's value, the fewest an associate subscribes, the instalments they may pay them in, and how one who leaves is repaid |
| **statement** | a worker's part of a year's work share, by basis, and what became of it once distributed: shares, blocked five years, and cash |
| **financial statements** | the income statement (compte de résultat) over a month, a quarter or a year and the balance sheet (bilan) at its end, from the journal in the PCG's rubrics, beside the span before; a **statement** alone is a worker's |
| **margin** | what a project invoiced less what its time cost the co-op and what was spent for it |
| **report** | a saved report of the `report` feat, read through the analytics port: the financial statements, the project margins, the federation figures, or a member's own |
| **burn** | the share of a project's budget its billable time has spent, at the rate card |
| **indivisible reserves** | surplus kept by the co-op for good, never distributed |
| **interest on capital** | the part of the surplus paid on members' capital shares, capped by law |
| **capital account** | a member's equity in the co-op: the shares they paid in and what is credited to them |
| **subscription** | the shares an associate takes on joining, at the share's value, called whole and paid in at once or in monthly instalments from their pay |
| **repayment** | what a departed associate is paid back of their capital, at its nominal value, in yearly instalments the statutes set, within five years |
| **patronage** | a worker's contribution used to divide a surplus; in a SCOP the work share's bases, pay, time worked or equal parts, never revenue; the feat holding the year-end cycle |
| **buy-in / buyout** | capital a member subscribes on joining, and its repayment on leaving |
| **revolving capital** | repaying the oldest retained patronage as new patronage is retained |
| **dues** | periodic payments every member owes |
| **period** | a month of the books; closed once its entries are final |
| **solidarity rate** | Lanterne's lower day rate for associations and small co-ops |

## Deciding

| Term | Meaning |
|---|---|
| **proposal** | a decision put to a circle, by a procedure, with its deadline |
| **procedure** | how a decision is taken: its rule, for a majority the share of the votes cast it needs, and its quorum; a circle decides by one unless a proposal names another, and a decision keeps the one it was proposed under |
| **supermajority** | a majority needing more than half of the votes cast, as two thirds: a procedure's share |
| **consent** | passes if no one objects at close; a member's latest stance counts |
| **objection** | a stance under consent that blocks while it stands |
| **stand aside** | disagreement recorded without blocking |
| **consensus** | everyone actively agrees; stricter than consent |
| **majority** | passes with more for than against among those voting; a supermajority raises the threshold |
| **votes cast** | the stances for and against; an abstention takes part but counts for neither |
| **quorum** | the participation a decision needs to count, a share of those it counts giving a stance; a meeting's, the share of its circle's seats present |
| **deliberation** | a decision's discussion: messages its circle's members post while it is open, each perhaps a reply |
| **mention** | a member named in a message by `@` and their handle, which waits in their inbox until they answer |
| **agenda** | a meeting's items in order, each tabling perhaps a decision; fixed once the meeting is held |
| **minutes** | a meeting's record, a document, adopted by decision where its circle says so |
| **roll** | who may vote on a decision |
| **delegate** | a member chosen to vote for others at a higher level |
| **adoption** | a decision making one version of a document binding |
| **outcome** | the result of a decision, folded from its signed votes, never stored |
| **open · passed · rejected** | a decision's state: open until its close, then passed or rejected by the outcome of the stances the close froze, read in SQL; "adopted" is a document version's, never a decision's |
