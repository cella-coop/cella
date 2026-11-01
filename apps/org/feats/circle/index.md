+++
title = "Circle"
updated = 2026-11-03
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
| role | `id`, `circle`, `name`, `duty` | `circle` is one circle, or `*` for a role every working circle has; `participant`, built in, is every circle's, the assembly's too |
| mandate | `id`, `role?`, `circle?`, `right?`, `power`, `policy`, `limit?`, `budget?`, `per?`, `from`, `until?`, `revoked?` | the values of the mandate policy `policy` that grants it: its holder is a `role`, an individual mandate, a `circle`, a collective one, or a `right`, the people who hold it as such, `person`, `member` or `employee`, only one; `power` is an id; `limit` caps a single write, in cents, `budget` caps a cumulative total over its `per` ("month" or "year"); `from` and `until` are the days its policy applies |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`; the feat owning a write names the power in
`cella.power`. A mandate grants one power to one role, with an optional
limit, for a term. Who holds a role is a seat, the `circle-membership`
graft's, so whether an actor may use a power is that graft's guard,
`circle_membership.may`: an actor may if a seat they hold on the day carries
a role with a mandate in force for the power, within its limit, the
circle's participant role among them. A power every member holds in a
circle is granted the same way, through a mandate on a role every member
is seated in, such as a `member` role in the assembly: nothing is
allowed by omission. A mandate on a circle itself, a collective mandate,
is no seat's: it is used only by a motion of that circle ([collective
mandates](#collective-mandates)). Nor is a right, which people hold as
such, every person, member or employee, to act on what is their own
([rights](#rights)).

## Mandates

A mandate is a policy, a sentence a circle adopted by motion
([policies](../../../../_corpus/doc/architecture.md#policies)), its
values marked in it: the role it grants to, the circle, or the right,
the power, and perhaps a limit per write or a budget over a month or a
year.

```text
The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 3 000 €} a write
The {role: lead} role holds {power: approve-expense}, to approve what the circle's members spend, within {budget: 1 000 €} a {per: month}
The {circle: ag} circle holds {power: admit-member}, to admit members, by motion
Every {right: employee} holds {power: claim-expense}, to claim their expenses and file their receipts
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
feat's too, `circle.mandate_flaw(marked)`: one of a role it has, a
circle it has or a right, `person`, `member` or `employee`, a power
named in lower case, at most a limit or a
budget, an amount, a budget with its `per`, and no other value.

## Collective mandates

A mandate on a role is individual: whoever holds a seat with that role
uses it. A mandate on a circle is collective: the circle holds it as a
whole and uses it only by motion, so no seat brings it. An action a
passed motion carries, such as admitting a member, adopting a policy or
nesting a circle, needs the power a collective mandate grants, and
takes effect only where the motion's circle holds one for that power:
`circle.holds(circle, power, day)`, which reads the circle's own
mandates, never those of a circle above or below it. The action's
power is registered with it in the motion feat's `motion.cites`, and
`circle-motion`, which joins this feat to the motion feat, checks it
when the motion is proposed and again when each action is carried out
([circle-motion](../../grafts/circle-motion/index.md#guards)).

| Power | Actions |
|---|---|
| `admit-member` | admitting a member (`membership:member:admit`), and the subscription that follows (`account:capital:subscribe`) |
| `suspend-member` | suspending a member (`membership:member:suspend`) |
| `exclude-member` | excluding a member (`membership:member:exclude`), and the freeze and withdrawal of capital that follow (`account:account:freeze`, `account:capital:withdraw`) |
| `adopt-policy` | adopting a policy (`motion:policy:adopt`), granting a mandate among them, and the copies into terms and the statutes that follow (`account:terms:adopt`, `patronage:terms:adopt`, `document:document:generate`) |
| `end-policy` | ending a policy (`motion:policy:end`), revoking a mandate among them |
| `approve-distribution` | approving a year's distribution (`patronage:distribution:approve`), and the posting and the parts employed that follow (`patronage:distribution:distribute`, `patronage:part:employ`) |
| `adopt-document` | adopting a document's version (`document:document:adopt`) |
| `nest-circle` | nesting a circle (`circle:circle:nest`) |
| `seat-member` | giving and ending a seat (`circle-membership:seat:add`, `:remove`) |

Where a collective mandate reaches is still `circle_motion.decides`: a
circle decides about those strictly within it, and the assembly about
every circle, itself included, so nesting circles and granting mandates
are the circle above's.

## The participant role

Every circle has a participant role, built in: the role `participant`,
whose `circle` is `*`, which this feat's migration makes, so no circle
is without it. Every seat in a circle holds it there, beside the seat's
own role if it has one; a seat above brings no participant role below,
so a member of the assembly is no participant of Marketing unless they
sit in Marketing too. The participant's mandates cover proposing and
discussing:

| Power | Actions |
|---|---|
| `propose` | proposing a motion of the circle (`motion:motion:propose`) and closing it (`motion:motion:close`) |
| `discuss` | posting on a motion's deliberation (`motion:message:post`), in the circle's channel (`circle:circle:message`), and adding, moving and removing an item of its meetings' agendas (`meeting:item:add`, `:move`, `:remove`) |

They are mandates like any other, each a policy, and since the role is
every circle's (`*`) they are the assembly's to grant and reach every
circle. `circle_membership.may` finds a participant's mandate on any seat
the actor holds; the guard of the graft that knows which circle an
action concerns (`circle_membership.sits`, `circle_membership_motion.sits`,
`circle_meeting_membership.sits`) asks for a seat in that circle. An
agent's or a service's seat would bring no participant role unless a
procedure says so: named, not built.

## Rights

A right is a mandate people hold as such, with no seat: on every person
(`{right: person}`), every member (`{right: member}`) or every employee
(`{right: employee}`), never an agent or a service. Who is one of them
on a day is person's core's to say, `person.holds(actor, right, day)`,
by the function each kind of person registers there: `person` the
people the co-op knows, `membership` its active members, `employment`
those employed. `circle-membership`'s guard on every op with a power
takes a right's mandate, `circle_membership.entitled`, beside those on
the actor's seats, so Inès, employed and no member, holds an employee's
rights beside the mandates of her seat in Web, and Paul, gone since 30
November 2025, a person's alone.

A right lets each act on what is their own: the feat's guard that the
record is theirs stays, and a right is never the authority a read asks
(`circle_membership.may`), so it opens no one else's rows. A right is a
mandate like any other, a policy, and is the assembly's to grant: it
reaches the whole co-op, and is neither carved nor carved from.

| Right | Power | Actions |
|---|---|---|
| person | `keep-profile` | their profile (`person:person:profile`) and erasing their contact details (`person:person:forget`) |
| person | `keep-devices` | enrolling and revoking their devices (`person:device:enrol`, `:revoke`) |
| person | `upload-file` | uploading a file of the co-op's (`file:file:upload`) |
| person | `accept-invitation` | taking up their invitation (`membership:member:accept`) |
| person | `file-record` | filing a record of their own (`file-membership:member:attach`) |
| person | `mark-read` | marking a text the co-op adopted read (`document-membership:version:read`) |
| person | `record-import` | recording an import of their own (`import:run:record`) |
| person | `withdraw-membership` | withdrawing their own membership, and the freeze and withdrawal of their capital that follow (`membership:member:withdraw`, `account:own:freeze`, `account:own:withdraw`); worded on every person, since the withdrawal ends the membership on its own verdict date, and held to a member's own by the membership feat's guard |
| person | `erase-own-data` | erasing all their own personal data once they have left (`membership:member:erase`), within the holds the law keeps; held to their own, and to one who has left, by the membership feat's guard |
| member | `draw-account` | drawing on their account within its draw limit (`account:account:draw`) |
| member | `spread-capital` | spreading what they owe over their pay (`account:capital:spread`) |
| member | `mark-attendance` | marking their attendance at a meeting (`meeting-membership:attendance:mark`) |
| member | `save-report` | saving a report of their own (`report:report:save`) |
| employee | `log-time` | logging, correcting and submitting their own time, booked to a project or not (`timesheet:entry:log`, `:entry:correct`, `:period:submit`) |
| employee | `claim-expense` | claiming an expense and submitting it, attaching its receipt and filing it on a project (`expense:expense:capture`, `:submit`, `expense-file:expense:attach`, `expense-project:expense:rebill`) |
| employee | `apply-membership` | applying to join once employed a year, which puts their admission to the assembly in the same write, and opening their candidacy, which follows it (`membership:member:apply`, `employment-membership:candidacy:open`); held to their own application by the membership feat's guard, and to a year's employment by employment-membership's |

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
before its `until` and before its `revoked`; `circle.holds(circle,
power, day)` asks whether a circle holds a collective mandate in force
for a power on a day.

## Authority

The assembly holds every power inherently: the co-op's members are its
sovereign. A mandate is carved from what the circles above hold: from
the mandates for the same power that the nearest circle above holding
it by a mandate holds, on its roles or on itself, or else from the
assembly, uncapped. A mandate's circle is its role's, or for a
collective mandate the circle it is on, so the two kinds are carved
alike and each is carved from both. Its cap never exceeds theirs: one
of them is uncapped, or limits a write by at least its limit, or
budgets the same period by at least its budget. A role every working
circle has (`*`) and a right are the assembly's to grant, and are
neither carved nor carved from. Nesting therefore matters: moving a circle changes what
its mandates are carved from. A power exercised "by motion" is a
collective mandate, held by a circle and used only through a motion of
that circle.

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
| nest | `nest-circle`, a collective mandate: the cited motion nests this circle there, and carried | the assembly or coordination, by motion |
| a mandate policy adopted or ended | `adopt-policy` or `end-policy`, collective mandates: the cited motion adopts or ends it, and carried | the assembly or coordination, by motion |
| message | `discuss`, held in the circle | the circle's participants |

Nesting and a mandate's policy are carried by a motion: they cite it,
which the `circle-motion` graft checks asks this, was put to a circle
that may decide it and that holds the collective mandate for the
power, and `circle-membership-motion` that it carried, and which
`circle-membership-motion` carries out when it passes. A message needs
the participant's `discuss`, which `circle_membership.may` finds on a
seat and `circle_membership.sits`, the `circle-membership` graft's guard,
on a seat in the message's circle.

## Guards

- `circle.nests`, on `circle:circle:nest`: the circle sits under the
  parent the payload names, and its path is its parent's as it stands.
- `circle.grants`, which `circle-motion` attaches to `motion:policy:adopt`:
  a mandate policy the write adopted has its mandate, on the role or the
  circle, for the power, capped and on the days its values and its
  policy say; the
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
- a mandate is on a role or on a circle, never both;
- a mandate caps its power with a `limit` per write or a `budget` over a
  period, never both;
- a mandate is its policy's values, on its policy's days; its term has
  `from` before `until`; a revoked mandate stays revoked.

What it does not own: who holds which role (`circle-membership`), and who
may vote on a circle's motions: the roll, those seated in the circle
when a motion is proposed as its procedure says, and the count of
those on it whose seat counts, are the `circle-membership-motion`
graft's.

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
| Member (every member, in `ag`) | `edit-client`, `edit-document`, `edit-task`, `invite-member` | — |
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
| Participant (every seat, in its circle) | `propose`, `discuss` | — |

| Circle, by motion | Power |
|---|---|
| Assemblée générale | `admit-member`, `suspend-member`, `exclude-member`, `adopt-policy`, `end-policy`, `approve-distribution`, `adopt-document`, `nest-circle`, `seat-member` |
| Coordination | `adopt-policy`, `end-policy`, `adopt-document`, `nest-circle`, `seat-member` |

| Right | Power |
|---|---|
| Every person | `keep-profile`, `keep-devices`, `upload-file`, `accept-invitation`, `file-record`, `mark-read`, `record-import`, `withdraw-membership`, `erase-own-data` |
| Every member | `draw-account`, `spread-capital`, `mark-attendance`, `save-report` |
| Every employee | `log-time`, `claim-expense` |

Each is a mandate policy of the assembly, adopted with the statutes by
the founding motion, m-2021-001, on 1 March 2021, and in force since.
So the working circles carry no action by motion: a motion of Web
decides by its text alone, and one carrying an action is refused at its
proposal until a circle above grants Web a collective mandate for it.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `circle.circles`, `circle.roles` and `circle.mandates` to the analytics shell: the circles, their roles and the mandates each role holds, with their limits and budgets.
