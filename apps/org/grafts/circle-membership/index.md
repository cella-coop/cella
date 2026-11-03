+++
title = "circle-membership"
updated = 2026-11-03
+++

Seats: which person holds which role in which circle. A seat is the
relationship, so the graft owns its actions. Any person may hold one,
member or not: the graft joins `circle` to `membership` because the
assembly's seats ask an active membership, and every other seat is a
person's place in a circle all the same.

## Schema

`circle_membership` (`sql/`):

- `circle_membership.seat`: a seat, by circle id and person address, with
  no foreign key into either feat; an optional `role`, and `since` and
  `until`. A seat with no `since` was held before the records began; an
  ended seat keeps its row with `until`, so who sat where on a past day
  reads back.
- `circle_membership.seated(circle, day)`: the people seated in a circle on a
  day. The `circle-membership-motion` graft, a higher order, fixes a
  motion's roll from it.
- `circle_membership.counts(person, circle, day)` (`007-active.sql`):
  whether a seat counts on a day: in the assembly, the root circle,
  where membership says the person is active (`membership.active`); in
  any other circle, where the person is one the co-op knows
  (`person.known`) and membership has not suspended them or let them
  go. A worker who is no member, invited or never, holds a seat in their
  working circle; a suspended member's seats grant nothing until the
  suspension is lifted.
- `circle_membership.sits_in(person, circle, day)`: they hold a seat in
  the circle on the day, and it counts; the guards that know the circle
  an action concerns ask it.

The app role and the guards role, `cella_guards`, may select; the app role
may insert a seat, through `seat.add`, and end one, through
`seat.remove`. Lanterne's seats are seeded.

## Guards

Who may use a power needs seats and mandates, and so lives here, the
lowest level that sees both: mandates are the `circle` feat's, seats this
graft's, and whether a member is active on a day the `membership` feat's
`membership.active(person, day)`, which the assembly's seats ask.

- `circle_membership.may(actor, power, cents, day)`: the actor holds, on
  the day, a seat that counts (`counts`), whose role, or the participant
  role every seat holds, has a mandate in force for the
  power, not revoked by the day, within its `limit` when the write
  carries an amount.
  A `budget` is not checked: it needs the spend over its period tracked.
  It is the authority every read asks (`cella.authority`), and finds no
  right.
- `circle_membership.entitled(actor, power, cents, day)` (`008-rights.sql`):
  the actor holds the power by a right, with no seat: a right in force
  in `circle.right`, no mandate, on every person, member or employee, within its `limit`, where
  person's core says the actor is one of them on the day
  (`person.holds`). A right lets each act on what is their own, which
  the feat's guard checks, so it opens no one else's rows to read
  ([rights](../../feats/circle/index.md#rights)).
- `circle_membership.empowered`, on every action in `cella.power`: the actor may
  use the action's power on the verdict date, by a seat (`may`) or by a
  right (`entitled`), for the amount the payload names
  in the action's `amount` field. Each feat registers the power its actions need
  in `cella.power`, a core registry; this graft attaches its guard to every
  op listed, then and later, as `circle-membership-motion` attaches its own
  to `motion.cites`. A write with no power, or whose power is in
  `motion.cites`, a collective mandate's, gets no such guard.
- `circle_membership.over(actor, power, about, day)`: the actor holds the
  power through a seat in force in the circle `about` or one it is
  within: a power reaches down the tree from where it is held, never up
  or across. It checks no limit and whether the seat counts, which `may`
  does for every write; the three-way grafts that know what a write
  concerns, `circle-membership-project` a project's circle and
  `circle-membership-timesheet` a worker's seats, narrow `may` with it.

Lanterne: Julien issues invoices, records payments, posts entries, closes
periods and pays suppliers up to 3 000 € a payment, as finance; Chloé
holds only the `member` seat in the assembly, so she edits clients and
documents and does none of these; Camille's `commit` mandate, up to
20 000 €, is not needed by any write yet. A suspended member holds no
seat's mandate. Inès, invited and employed, no member yet, sits in Web
since her hire: she holds Web's participant mandates there, proposing
and discussing in Web, and none of the assembly's; beside them, a
person's rights and an employee's. Paul, gone, holds a person's alone.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/circle-membership/seat.add` | ordered | who holds which role |
| `POST /api/circle-membership/seat.remove` | ordered | who holds which role |

- **seat.add** and **seat.remove** change who holds a role in a
  circle, and so who may use the powers a mandate grants it. Spending
  writes read seats through `circle_membership.may`, so they are ordered.
- Both need `seat-member`, a collective mandate of the circle whose
  motion carries them: each cites the motion that
  gives or ends the seat. This graft does not join `motion`, so the
  guards that judge them are `circle-membership-motion`'s, a higher order:
  the cited motion carried, and it gives or ends this seat, which in
  the assembly is an active member's and elsewhere any person's whom
  membership has not suspended or let go. An admission gives one, the
  new member's in the motion's circle in its `member` role; a `seat` or
  `unseat` action names any other.

## Handlers

- `add` (ordered), and `seating`, its state alone, which a passing
  close runs in its own transaction for each member it admits: inserts
  the seat from the verdict date and commits its id, circle, member, role
  and the motion it cites.
- `remove` (ordered): ends the member's seat in the circle, in the role
  or as a plain member, on the verdict date, and commits the same.

`circle-membership-motion` carries out the seats a passing motion gives
and ends, as its reaction to the close.

## Powers

| Action | Check | Lanterne |
|---|---|---|
| seat.add | decided: the motion it cites gives this seat | the assembly, admitting a member; the circle above, seating one |
| seat.remove | decided: the motion it cites ends this seat | the circle above, or the assembly |

`004-sits.sql` registers `circle_membership.sits` on `circle:circle:message`:
the actor holds a seat that counts in the circle on the verdict date,
where the participant's `discuss` is held.

## Reads

It is the authority every read asks (`cella.authority`, `sql/006-authority.sql`): `may`, on the verdict date, says whether the reader holds a power a feat names as reading its rows in `cella.reading` ([the pattern](../../../../_corpus/doc/architecture.md#sql)).

## Shell

Adds a circle's seats to its page, one row per person with every role
they hold in it, and how many sit in it to the list and its gallery
cards; and to a person's page their seats and the powers they hold
through them, each power by its plain name and its policy's sentence,
the mandates `circle_membership.may` would grant before any limit is spent,
and to the list the circles they sit in; under Joining, whether they sit
in the assembly and in a working circle; and under Own and decide, what
they decide read back as sentences: where they sit, how each of those
circles decides, and the mandates they act by, each as its policy
reads, its limit in it.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `circle_membership.seats` to the analytics shell: who holds which role in which circle, and when.
