+++
title = "Circle"
updated = 2026-10-30
+++

The co-op's structure and the authority that flows through it. A circle is
a self-governing unit, after sociocracy: the general assembly, a
coordination circle, a working team. Circles nest in one tree whose root is
the assembly. Each circle defines roles, and grants powers to them through
mandates; who holds a role is a position, the `circle-membership` graft's
junction. Each circle also has a channel for its messages.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| circle | `id`, `name`, `parent?`, `purpose`, `procedure` | the root has no parent; `procedure` names the procedure its decisions are taken by unless a proposal names another: consent, majority, two thirds or one of the co-op's own, which the decision feat holds and `circle-decision` checks |
| role | `id`, `circle`, `name`, `duty` | `circle` is one circle, or `*` for a role every working circle has |
| mandate | `id`, `role`, `power`, `text`, `limit?`, `budget?`, `from`, `until?`, `revoked?` | `power` is an id; `text` is how members read it; `limit` caps a single write, in cents, `budget` caps a cumulative total over its `per` ("month" or "year") |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`; the feat owning a write names the power in
`cella.power`. A mandate grants one power to one role, with an optional
limit, for a term. Who holds a role is a position, the `circle-membership`
graft's, so whether an actor may use a power is that graft's rule,
`circle_membership.may`: an actor may if a seat they hold on the day carries
a role with a mandate in force for the power, within its limit. A power
every member holds is granted the same way, through a mandate on a role
every member is seated in, such as a `member` role in the assembly:
nothing is allowed by omission.

## Schema

`circle` (`core/sql/`): `circle.circle`, `circle.role` and
`circle.mandate`, as in the entities above; a mandate's `limit` and
`budget` are `cella.amount`s, and a mandate with no `from` was granted
before the records began. Each circle keeps its `path`, its ancestors
from the assembly down and itself last, which triggers keep as circles
are added and moved, a moved circle carrying its subtree; so
`circle.within(part, whole)` asks whether one circle is within another
without recursion. One circle only has no parent. Triggers refuse a
nesting that makes a cycle and keep a mandate's grant fixed and a
revocation standing, raising SQLSTATE `09000`. The app role and the rules
role, `cella_rules`, may select; the app role may move a circle and grant
and revoke mandates.

## Authority

The assembly holds every power inherently: the co-op's members are its
sovereign. A mandate is carved from what the circles above hold: from
the mandates for the same power on the roles of the nearest circle
above that holds it by a mandate, or else from the assembly, uncapped.
Its cap never exceeds theirs: one of them is uncapped, or limits a
write by at least its limit, or budgets the same period by at least its
budget. A role every working circle has (`*`) is the assembly's to
grant, and is neither carved nor carved from. Nesting therefore matters:
moving a circle changes what its mandates are carved from. A power exercised "by decision" is held by a circle and used
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

Who holds which role is a position, the `circle-membership` graft's own
write; see its [doc](../../grafts/circle-membership/index.md).

- **nest** sets a circle's parent. Two nestings that are each acyclic can
  together form a cycle, so the notary orders them already at rung 1:
  two concurrent transactions can each see no cycle. The tree's trigger
  refuses a cycle in the write's own view; `circle.nests`, run under the
  log's lock, refuses one a nesting settled first made.
- **mandate.grant** and **mandate.revoke** change what a role may do. A
  revocation takes effect at its receipt: a write received after it is
  refused; a share already granted runs out on its own.
- **message** posts to the channel. Messages merge in any order; it has
  no handler yet.

## Powers

| Write | Power or check | Lanterne |
|---|---|---|
| nest | decided: the cited decision nests this circle there, and carried | the circle holding both places, or the assembly |
| mandate.grant, mandate.revoke | decided: the cited decision grants or revokes this mandate, and carried | the circle above the role's, or the assembly |
| message | seat: an active member seated in the circle | the circle's members |

Nesting, granting and revoking are decided: they cite a decision, which
the `circle-decision` graft checks asks this and was put to a circle that
may decide it, and `circle-decision-membership` that it carried, and which
`circle-decision-membership` carries out when it passes. A message's seat
check is `circle_membership.sits`, the `circle-membership` graft's rule.

## Rules

- `circle.nests`, on `circle:circle:nest`: the circle sits under the
  parent the payload names, and its path is its parent's as it stands.
- `circle.grants`, on `circle:mandate:grant`: the write granted the
  mandate the payload names, to that role, for that power, from the
  verdict date.
- `circle.revokes`, on `circle:mandate:revoke`: the write revoked the
  mandate on the verdict date.
- `circle.carves`, on all three: after the write, every mandate in force
  is carved from what the circles above hold (`circle.beyond(day)`, the
  first that is not, as a reason). A grant beyond its source is refused;
  so is a nesting that moves a subtree under circles holding less than
  its mandates, and a revocation that leaves a mandate carved from it
  beyond what remains above: revoke the carved mandate first.

## Handlers

- `nest`, `grant`, `revoke` (ordered), each citing its decision: set the
  parent; insert the mandate from the verdict date, its limit or budget
  in cents; set `revoked`. Each submits what it did and the decision; a
  mandate's text is how members read it and stays in the payload.

## Invariants

The circle feat owns:

- the circles form one tree: no cycle, one root;
- a mandate is carved from what the circles above hold (`circle.carves`);
- a mandate caps its power with a `limit` per write or a `budget` over a
  period, never both;
- a mandate's term has `from` before `until`; a revoked mandate stays
  revoked.

What it does not own: who holds which role (`circle-membership`), and who
may vote on a circle's decisions: the roll, the members seated in the
circle when a decision is proposed, and the count of the active members
on it, are the `circle-decision-membership` graft's.

## What it does not know

Circle knows no members, decisions or accounts. Templates of roles for
common co-op shapes, colleges of a multi-stakeholder co-op and mandates
requested by another scope (rung 5) build on these entities later.

## Shell

The `circles` collection, in tree order, as a gallery of cards by
default; a circle's page lists its roles,
those every working circle has among them, and the mandates granted to
them, with their limits and budgets. Seats are `circle-membership`'s.
Proposing to nest the circle or to grant or revoke its mandates is
`circle-decision`'s, a seat in it `circle-decision-membership`'s: the page's
writes propose, and the close of a passing decision carries them out.

## Grafts

- `circle-membership`: seats, and who may use a power.
- `circle-decision`: nesting and mandates by decision.
- `circle-membership-project`, `circle-membership-timesheet`: a power reaches the
  circle it is held in and those within it, for projects and timesheets;
  the months waiting on a member's approval, in their inbox.

## Lanterne

| Circle | Parent | Purpose |
|---|---|---|
| Assemblée générale | — | every member, one vote: statutes, admissions, accounts and surplus |
| Coordination | ag | weekly: pipeline, staffing and anything that crosses circles |
| Web, Brand, Marketing, Operations | coordination | the working circles |

| Role | Power | Cap |
|---|---|---|
| Member (every member, in `ag`) | `edit-client`, `edit-document`, `edit-task`, `log-time`, `invite-member` | — |
| Gérante (Camille, in `ag`, 2024–2028) | `commit` | 20 000 € limit |
| Gérante | `approve-expense` | 2 000 € limit |
| Gérante | `set-budget` | 50 000 € limit |
| Gérante | `approve-bill` | 5 000 € limit |
| Gérante | `approve-payroll`, `manage-project`, `approve-time` | — |
| Treasurer (Julien, in `ag`) | `approve-time` | — |
| Finance (Julien, in `operations`) | `pay-supplier`, `reimburse-expense` | 3 000 € limit |
| Finance | `record-entry`, `issue-invoice`, `record-receipt`, `record-bill`, `close-period`, `prepare-payroll`, `pay-payroll` | — |
| Circle lead (`*`) | `approve-expense` | 1 000 € budget, a month |
| Circle lead | `send-quote` | 15 000 € limit |
| Circle lead | `set-budget` | 15 000 € limit |
| Circle lead | `manage-project`, `approve-time` | — |
| Circle lead | `schedule-meeting`, `keep-minutes` | — |
| Gérante | `schedule-meeting`, `erase-personal-data` | — |
| Secretary (`*`: Julien in the assembly, Malik in coordination) | `keep-minutes` | — |

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `circle.circles`, `circle.roles` and `circle.mandates` to the analytics shell: the circles, their roles and the mandates each role holds, with their limits and budgets.
