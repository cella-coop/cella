+++
title = "Circle"
updated = 2026-11-02
+++

The co-op's structure and the authority that flows through it. A circle is
a self-governing unit, after sociocracy: the general assembly, a
coordination circle, a working team. Circles nest in one tree whose root is
the assembly. Each circle defines roles, and grants powers to them through
mandates; who holds a role is a seat, the `circle-membership` graft's
junction. Each circle also has a channel for its messages.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| circle | `id`, `name`, `parent?`, `purpose`, `procedure` | the root has no parent; `procedure` names the procedure its motions are taken by unless a proposal names another: consent, majority, two thirds or one of the co-op's own, which the motion feat holds and `circle-motion` checks |
| role | `id`, `circle`, `name`, `duty` | `circle` is one circle, or `*` for a role every working circle has |
| mandate | `id`, `role`, `power`, `policy`, `limit?`, `budget?`, `per?`, `from`, `until?`, `revoked?` | the values of the mandate policy `policy` that grants it: `power` is an id; `limit` caps a single write, in cents, `budget` caps a cumulative total over its `per` ("month" or "year"); `from` and `until` are the days its policy applies |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`; the feat owning a write names the power in
`cella.power`. A mandate grants one power to one role, with an optional
limit, for a term. Who holds a role is a seat, the `circle-membership`
graft's, so whether an actor may use a power is that graft's guard,
`circle_membership.may`: an actor may if a seat they hold on the day carries
a role with a mandate in force for the power, within its limit. A power
every member holds is granted the same way, through a mandate on a role
every member is seated in, such as a `member` role in the assembly:
nothing is allowed by omission.

## Mandates

A mandate is a policy, a sentence a circle adopted by motion
([policies](../../../../_corpus/doc/architecture.md#policies)), its
values marked in it: the role it grants to, the power, and perhaps a
limit per write or a budget over a month or a year.

```text
The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 3 000 €} a write
The {role: lead} role holds {power: approve-expense}, to approve what the circle's members spend, within {budget: 1 000 €} a {per: month}
```

Its term is its policy's days: it applies from the day its motion names
or its verdict, and until the day it names, if any. Granting a mandate
is adopting its policy, and its values are copied into `circle.mandate`
in the same write, so `circle_membership.may` reads a column, never the
sentence; revoking one is ending its policy, which revokes its mandate
on the verdict date. A mandate policy replacing another revokes the
other's mandate the day it applies. The copy is this feat's, by
`circle.mandate_from(policy)` and `circle.mandate_ended(policy)`, which
read the register's values and never its wording; the write that calls
them is `circle-motion`'s, which joins this feat to the motion feat's
adoption and ending of a policy. What a mandate's values may be is this
feat's too, `circle.mandate_flaw(marked)`: a role it has, a power named
in lower case, at most a limit or a budget, an amount, a budget with its
`per`, and no other value.

## Schema

`circle` (`core/sql/`): `circle.circle`, `circle.role` and
`circle.mandate`, as in the entities above; a mandate's `limit` and
`budget` are `cella.amount`s, and each mandate names the policy that
grants it, one mandate a policy. Each circle keeps its `path`, its ancestors
from the assembly down and itself last, which triggers keep as circles
are added and moved, a moved circle carrying its subtree; so
`circle.within(part, whole)` asks whether one circle is within another
without recursion. One circle only has no parent. Triggers refuse a
nesting that makes a cycle and keep a mandate's grant fixed and a
revocation standing, raising SQLSTATE `09000`. The app role and the guards
role, `cella_guards`, may select; the app role may move a circle and grant
and revoke mandates. A mandate is in force on a day from its `from`,
before its `until` and before its `revoked`.

## Authority

The assembly holds every power inherently: the co-op's members are its
sovereign. A mandate is carved from what the circles above hold: from
the mandates for the same power on the roles of the nearest circle
above that holds it by a mandate, or else from the assembly, uncapped.
Its cap never exceeds theirs: one of them is uncapped, or limits a
write by at least its limit, or budgets the same period by at least its
budget. A role every working circle has (`*`) is the assembly's to
grant, and is neither carved nor carved from. Nesting therefore matters:
moving a circle changes what its mandates are carved from. A power exercised "by motion" is held by a circle and used
only through a motion of that circle's members.

## Lifecycle

| Thing | States |
|---|---|
| circle | active → dissolved |
| mandate | granted, as its policy is adopted → revoked, as its policy ends, or expired at `until` |
| seat | held → ended (the graft's) |

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/circle/nest` | ordered | two nestings can form a cycle even online |
| `POST /api/circle/message` | confluent | the circle's channel |

Who holds which role is a seat, the `circle-membership` graft's own
action; see its [doc](../../grafts/circle-membership/index.md). A
mandate has no action of its own: it is granted and revoked by the
motion feat's `motion:policy:adopt` and `motion:policy:end`, both
ordered, which `circle-motion` extends with this feat's `granting` and
`revoking`.

- **nest** sets a circle's parent. Two nestings that are each acyclic can
  together form a cycle, so the notary orders them already at rung 1:
  two concurrent transactions can each see no cycle. The tree's trigger
  refuses a cycle in the write's own view; `circle.nests`, run under the
  log's lock, refuses one a nesting settled first made.
- A mandate's grant and revocation change what a role may do. A
  revocation takes effect at its receipt: a write received after it is
  refused; a share already granted runs out on its own.
- **message** posts to the channel. Messages merge in any order; it has
  no handler yet.

## Powers

| Action | Power or check | Lanterne |
|---|---|---|
| nest | decided: the cited motion nests this circle there, and carried | the circle holding both places, or the assembly |
| a mandate policy adopted or ended | decided: the cited motion adopts or ends it, and carried | the circle above the role's, or the assembly |
| message | seat: an active member seated in the circle | the circle's members |

Nesting and a mandate's policy are decided: they cite a motion, which
the `circle-motion` graft checks asks this and was put to a circle that
may decide it, and `circle-membership-motion` that it carried, and which
`circle-membership-motion` carries out when it passes. A message's seat
check is `circle_membership.sits`, the `circle-membership` graft's guard.

## Guards

- `circle.nests`, on `circle:circle:nest`: the circle sits under the
  parent the payload names, and its path is its parent's as it stands.
- `circle.grants`, which `circle-motion` attaches to `motion:policy:adopt`:
  a mandate policy the write adopted has its mandate, on the role, for
  the power, capped and on the days its values and its policy say; the
  mandate of the policy it replaces is revoked the day it applies; and no
  policy of another kind has one.
- `circle.revokes`, which `circle-motion` attaches to `motion:policy:end`:
  the mandate of a mandate policy the write ended is revoked on the
  verdict date.
- `circle.carves`, on `circle:circle:nest`, and which `circle-motion`
  attaches to both: after the write, every mandate in force is carved
  from what the circles above hold (`circle.beyond(day)`, the first that
  is not, as a reason). A grant beyond its source is refused; so is a
  nesting that moves a subtree under circles holding less than its
  mandates, and a revocation that leaves a mandate carved from it beyond
  what remains above: end the carved mandate's policy first.

## Handlers

- `nest` (ordered), citing its motion: sets the parent, and submits what
  it did and the motion.
- `granting(tx, policy)` and `revoking(tx, policy)`, the state of a write
  a graft extends: copy a mandate policy's values into `circle.mandate`,
  and revoke the mandate of an ended one and of the one a new policy
  replaces, by `circle.mandate_from` and `circle.mandate_ended`; each
  returns the mandate, or none for a policy of another kind.

## Invariants

The circle feat owns:

- the circles form one tree: no cycle, one root;
- a mandate is carved from what the circles above hold (`circle.carves`);
- a mandate caps its power with a `limit` per write or a `budget` over a
  period, never both;
- a mandate is its policy's values, on its policy's days; its term has
  `from` before `until`; a revoked mandate stays revoked.

What it does not own: who holds which role (`circle-membership`), and who
may vote on a circle's motions: the roll, the members seated in the
circle when a motion is proposed, and the count of the active members
on it, are the `circle-membership-motion` graft's.

## What it does not know

Circle knows no members, motions or accounts; it reads the policy
register in org's core, never a policy's wording. Templates of roles for
common co-op shapes, colleges of a multi-stakeholder co-op and mandates
requested by another scope (rung 5) build on these entities later.

## Shell

The `circles` collection, in tree order, as a gallery of cards by
default; a circle's page lists its roles,
those every working circle has among them, and the mandates granted to
them, each its policy's sentence as it reads (`sentences` in
`@cella/org-policy`), with their limits, budgets and days. Seats are
`circle-membership`'s. Proposing to nest the circle, or to grant a
mandate to one of its roles or revoke one, is `circle-motion`'s, a seat
in it `circle-membership-motion`'s: the page's writes propose, and the
close of a passing motion carries them out.

## Grafts

- `circle-membership`: seats, and who may use a power.
- `circle-motion`: nesting by motion, and mandates as the policies its
  circles adopt and end.
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

Each is a mandate policy of the assembly, adopted with the statutes by
the founding motion, m-2021-001, on 1 March 2021, and in force since.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `circle.circles`, `circle.roles` and `circle.mandates` to the analytics shell: the circles, their roles and the mandates each role holds, with their limits and budgets.
