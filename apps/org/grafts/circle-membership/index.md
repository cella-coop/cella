+++
title = "circle-membership"
updated = 2026-10-30
+++

Positions: which member holds which role in which circle. A position is
the relationship, so the graft owns its writes.

## Schema

`circle_membership` (`sql/`):

- `circle_membership.position`: a seat, by circle id and member address, with
  no foreign key into either feat; an optional `role`, and `since` and
  `until`. A seat with no `since` was held before the records began; an
  ended seat keeps its row with `until`, so who sat where on a past day
  reads back.
- `circle_membership.seated(circle, day)`: the members seated in a circle on a
  day. The `circle-decision-membership` graft, a higher order, fixes a
  decision's roll from it.

The app role and the rules role, `cella_rules`, may select; the app role
may insert a seat, through `position.add`, and end one, through
`position.remove`. Lanterne's seats are seeded.

## Rules

Who may use a power needs seats and mandates, and so lives here, the
lowest level that sees both: mandates are the `circle` feat's, seats this
graft's, and whether a member is active on a day the `membership` feat's
`membership.active(person, day)`.

- `circle_membership.may(actor, power, cents, day)`: the actor is active and
  holds, on the day, a seat whose role has a mandate in force for the
  power, not revoked, within its `limit` when the write carries an amount.
  A `budget` is not checked: it needs the spend over its period tracked.
- `circle_membership.empowered`, on every op in `cella.power`: the actor may
  use the op's power on the verdict date, for the amount the payload names
  in the op's `amount` field. Each feat registers the power its ops need
  in `cella.power`, a core registry; this graft attaches its rule to every
  op listed, then and later, as `circle-decision-membership` attaches its own
  to `decision.cites`. A write with no power gets no such rule.
- `circle_membership.over(actor, power, about, day)`: the actor holds the
  power through a seat in force in the circle `about` or one it is
  within: a power reaches down the tree from where it is held, never up
  or across. It checks no limit and no active status, which `may` does
  for every write; the three-way grafts that know what a write concerns,
  `circle-membership-project` a project's circle and `circle-membership-timesheet`
  a member's seats, narrow `may` with it.

Lanterne: Julien issues invoices, records payments, posts entries, closes
periods and pays suppliers up to 3 000 € a payment, as finance; Chloé
holds only the `member` seat in the assembly, so she edits clients and
documents and does none of these; Camille's `commit` mandate, up to
20 000 €, is not needed by any write yet. A suspended member, or an
invitee, holds nothing.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/circle-membership/position.add` | ordered | who holds which role |
| `POST /api/circle-membership/position.remove` | ordered | who holds which role |

- **position.add** and **position.remove** change who holds a role in a
  circle, and so who may use the powers a mandate grants it. Spending
  writes read positions through `circle_membership.may`, so they are ordered.
- Both are decided (`check: 'decided'`): each cites the decision that
  gives or ends the seat. This graft does not join `decision`, so the
  rules that judge them are `circle-decision-membership`'s, a higher order:
  the cited decision carried, and it gives or ends this seat. An
  admission gives one, the new member's in the decision's circle in its
  `member` role; a `seat` or `unseat` motion names any other.

## Handlers

- `add` (ordered), and `seating`, its state alone, which a passing
  close runs in its own transaction for each member it admits: inserts
  the seat from the verdict date and commits its id, circle, member, role
  and the decision it cites.
- `remove` (ordered): ends the member's seat in the circle, in the role
  or as a plain member, on the verdict date, and commits the same.

`circle-decision-membership` carries out the seats a passing decision gives
and ends, as its reaction to the close.

## Powers

| Write | Check | Lanterne |
|---|---|---|
| position.add | decided: the decision it cites gives this seat | the assembly, admitting a member; the circle above, seating one |
| position.remove | decided: the decision it cites ends this seat | the circle above, or the assembly |

`004-sits.sql` registers `circle_membership.sits` on `circle:circle:message`:
the actor is an active member seated in the circle on the verdict date.

## Reads

It is the authority every read asks (`cella.authority`, `sql/006-authority.sql`): `may`, on the verdict date, says whether the reader holds a power a feat names as reading its rows in `cella.reading` ([the pattern](../../../../_corpus/doc/architecture.md#sql)).

## Shell

Adds a circle's seats to its page, one row per person with every role
they hold in it, and how many sit in it to the list and its gallery
cards; and to a person's page their seats and the powers they hold
through them, each power by its plain name,
the mandates `circle_membership.may` would grant before any limit is spent,
and to the list the circles they sit in; under Joining, whether they sit
in the assembly and in a working circle; and under Own and decide, what
they decide read back as sentences: where they sit, how each of those
circles decides, and what their mandates let them do, within what
limit.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `circle_membership.positions` to the analytics shell: who holds which role in which circle, and when.
