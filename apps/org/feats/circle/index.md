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
| mandate | `id`, `role`, `power`, `text`, `limit?`, `budget?`, `from`, `until?`, `revoked?` | `power` is an id; `text` is how members read it; `limit` caps a single write, in cents, `budget` caps a cumulative total over its `per` ("month" or "year") |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`; the feat owning a write names the power in
`cella.power`. A mandate grants one power to one role, with an optional
limit, for a term. Who holds a role is a position, the `circle-member`
graft's, so whether an actor may use a power is that graft's rule,
`circle_member.may`: an actor may if a seat they hold on the day carries
a role with a mandate in force for the power, within its limit. A power
every member holds is granted the same way, through a mandate on a role
every member is seated in, such as a `member` role in the assembly:
nothing is allowed by omission.

## Schema

`circle` (`core/sql/`): `circle.circle`, `circle.role` and
`circle.mandate`, as in the entities above; a mandate's `limit` and
`budget` are `cella.amount`s, and a mandate with no `from` was granted
before the records began. The app role and the rules role, `cella_rules`,
may select. They are seeded; the writes below have no handlers yet.

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
| `POST /api/circle/nest` | ordered | two nestings can form a cycle even online |
| `POST /api/circle/mandate.grant` | ordered | authority, capped by a limit or a budget |
| `POST /api/circle/mandate.revoke` | ordered | authority, capped by a limit or a budget |
| `POST /api/circle/message` | confluent | the circle's channel |

Who holds which role is a position, the `circle-member` graft's own
write; see its [doc](../../grafts/circle-member/index.md).

- **nest** sets a circle's parent. Two nestings that are each acyclic can
  together form a cycle, so the notary orders them already at rung 1:
  two concurrent transactions can each see no cycle.
- **mandate.grant** and **mandate.revoke** change what a role may do. A
  revocation takes effect at its receipt: a write received after it is
  refused; a share already granted runs out on its own.
- **message** posts to the channel. Messages merge in any order.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| nest | held by the assembly, by decision | `ag` |
| mandate.grant, mandate.revoke | held by the granting circle, by decision | `ag` for the manager's mandate |
| message | none: every position holder in the circle | the circle's members |

## Invariants

The circle feat owns:

- the circles form one tree: no cycle, one root;
- a mandate grants a power its circle holds, within its parent's limit;
- a mandate caps its power with a `limit` per write or a `budget` over a
  period, never both;
- a mandate's term has `from` before `until`; a revoked mandate stays
  revoked.

What it does not own: who holds which role (`circle-member`), and who
may vote on a circle's decisions: the roll, the members seated in the
circle when a decision is proposed, and the count of the active members
on it, are the `circle-decision-member` graft's.

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

| Role | Power | Cap |
|---|---|---|
| Member (every member, in `ag`) | `edit-client`, `edit-document` | — |
| Gérante (Camille, 2024–2028) | `commit` | 20 000 € limit |
| Finance (Julien) | `pay-supplier` | 3 000 € limit |
| Finance | `record-entry`, `issue-invoice`, `record-receipt`, `close-period` | — |
| Circle lead | `spend-circle` | 1 000 € budget, a month |
| Circle lead | `send-quote` | 15 000 € limit |
