+++
title = "Circle"
updated = 2026-10-24
+++

The co-op's structure and the authority that flows through it. A circle is
a self-governing unit, after sociocracy: the general assembly, a
coordination circle, a working team. Circles nest in one tree whose root is
the assembly. Each circle defines roles, and grants powers to them through
mandates; who holds a role is a position, the `circle-member` graft's
junction. Each circle also has a channel for its messages.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| circle | `id`, `name`, `parent?`, `purpose`, `procedure` | the root has no parent; `procedure` is the default decision rule, `consent` or `majority` |
| role | `id`, `circle`, `name`, `duty` | `circle` is one circle, or `*` for a role every working circle has |
| mandate | `id`, `role`, `power`, `text`, `max_amount?`, `from`, `until?`, `revoked?` | `power` is an id; `text` is how members read it |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`. A mandate grants one power to one role, with an
optional limit, for a term. `cella.may(actor, power, amount)` reads
mandates as rows: an actor may if a role they hold carries the power
within its limit. Positions live in the `circle-member` graft, so
`cella.may` reads them there.

## Authority

The assembly holds every power inherently: the co-op's members are its
sovereign. A circle grants only powers it holds, by its own mandate or
from its parent's, and a mandate's limit never exceeds the limit it is
carved from. Nesting therefore matters: moving a circle changes what it
can grant. A power exercised "by decision" is held by a circle and used
only through a decision of that circle's members.

## Lifecycle

| Thing | States |
|---|---|
| circle | active → dissolved |
| mandate | granted → revoked, or expired at `until` |
| position | held → ended (the graft's) |

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/circle/nest` | ordered | two offline nestings can form a cycle |
| `POST /api/circle/position.add` | ordered | who holds which role |
| `POST /api/circle/position.remove` | ordered | who holds which role |
| `POST /api/circle/mandate.grant` | ordered | authority, with limits such as maxAmount |
| `POST /api/circle/mandate.revoke` | ordered | authority, with limits such as maxAmount |
| `POST /api/circle/message` | confluent | the circle's channel |

- **nest** sets a circle's parent. Two nestings that are each acyclic can
  together form a cycle, so the notary orders them and refuses the second.
- **position.add** and **position.remove** change who holds a role, and so
  who may use its powers. Spending writes are checked against them, so
  they are ordered. The row they write is the `circle-member` graft's.
- **mandate.grant** and **mandate.revoke** change what a role may do. A
  revocation takes effect at its receipt: a write received after it is
  refused; a share already granted runs out on its own.
- **message** posts to the channel. Messages merge in any order.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| nest | held by the assembly, by decision | `ag` |
| position.add, position.remove | held by the circle, by decision; the manager's election is the assembly's | each circle for its own seats |
| mandate.grant, mandate.revoke | held by the granting circle, by decision | `ag` for the manager's mandate |
| message | none: every position holder in the circle | the circle's members |

## Invariants

The circle feat owns:

- the circles form one tree: no cycle, one root;
- a mandate grants a power its circle holds, within its parent's limit;
- a mandate's term has `from` before `until`; a revoked mandate stays
  revoked.

What it does not own: who holds which role (`circle-member`), whose vote
counts in a circle's decisions (`decision-member`, from positions), and
the electorate of a decision (a later `circle-decision` graft; today a
decision names its circle as text).

## What it does not know

Circle knows no members, decisions or accounts. Templates of roles for
common co-op shapes, colleges of a multi-stakeholder co-op and mandates
requested by another scope (rung 5) build on these entities later.

## Lanterne

| Circle | Parent | Purpose |
|---|---|---|
| Assemblée générale | — | every member, one vote: statutes, admissions, accounts and surplus |
| Coordination | ag | weekly: pipeline, staffing and anything that crosses circles |
| Web, Brand, Marketing, Operations | coordination | the working circles |

| Role | Power | Limit |
|---|---|---|
| Gérante (Camille, 2024–2028) | `commit` | 20 000 € |
| Finance (Julien) | `pay-supplier` | 3 000 € |
| Finance | `issue-invoice`, `close-period` | — |
| Circle lead | `spend-circle` | 1 000 € |
| Circle lead | `send-quote` | 15 000 € |
