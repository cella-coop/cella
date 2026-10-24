+++
title = "circle-member"
updated = 2026-10-24
+++

Positions: which member holds which role in which circle. A position is
the relationship, so the graft owns its writes.

## Schema

`circle_member` (`sql/`):

- `circle_member.position`: a seat, by circle id and member address, with
  no foreign key into either feat; an optional `role`, and `since` and
  `until`. A seat with no `since` was held before the records began; an
  ended seat keeps its row with `until`, so who sat where on a past day
  reads back.
- `circle_member.seated(circle, day)`: the members seated in a circle on a
  day. The `circle-decision-member` graft, a higher order, fixes a
  decision's roll from it.

The app role and the rules role, `cella_rules`, may select; the app role
may insert a seat, through `position.add`. Lanterne's seats are seeded.

## Rules

Who may use a power needs seats and mandates, and so lives here, the
lowest level that sees both: mandates are the `circle` feat's, seats this
graft's, and whether a member is active the `member` feat's.

- `circle_member.may(actor, power, cents, day)`: the actor is active and
  holds, on the day, a seat whose role has a mandate in force for the
  power, not revoked, within its `limit` when the write carries an amount.
  A `budget` is not checked: it needs the spend over its period tracked.
- `circle_member.empowered`, on every op in `cella.power`: the actor may
  use the op's power on the verdict date, for the amount the payload names
  in the op's `amount` field. Each feat registers the power its ops need
  in `cella.power`, a core registry; this graft attaches its rule to every
  op listed, then and later, as `circle-decision-member` attaches its own
  to `decision.cites`. A write with no power gets no such rule.

Lanterne: Julien issues invoices, records payments, posts entries, closes
periods and pays suppliers up to 3 000 € a payment, as finance; Chloé
holds only the `member` seat in the assembly, so she edits clients and
documents and does none of these; Camille's `commit` mandate, up to
20 000 €, is not needed by any write yet. A suspended member, or an
invitee with a device, holds nothing.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/circle-member/position.add` | ordered | who holds which role |
| `POST /api/circle-member/position.remove` | ordered | who holds which role |

- **position.add** and **position.remove** change who holds a role in a
  circle, and so who may use the powers a mandate grants it. Spending
  writes read positions through `circle_member.may`, so they are ordered.
- **position.add** is decided (`check: 'decided'`): it cites the decision
  that gives the seat. This graft does not join `decision`, so the rules
  that judge it are `circle-decision-member`'s, a higher order: the cited
  decision carried, and it gives this seat. Today only an admission gives
  one, seating the new member in the decision's circle in its `member`
  role.

## Handlers

- `add` (ordered): inserts the seat from the verdict date and commits its
  id, circle, member, role and the decision it cites.
  `circle-decision-member`'s `closed` calls it after an admission
  settles.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| position.add | none: the decision it cites, which must give this seat | the assembly, admitting a member |
| position.remove | `appoint`, until a circle's decision decides it | no mandate grants it |

`004-sits.sql` registers position.remove's power, and `circle_member.sits`
on `circle:circle:message`: the actor is an active member seated in the
circle on the verdict date.

## Shell

Adds a circle's seats to its page and how many sit in it to the list and
its gallery cards; and
to a member's page their seats and the powers they hold through them,
the mandates `circle_member.may` would grant before any limit is spent,
and to the list the circles they sit in.
