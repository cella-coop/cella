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

The app role and the rules role, `cella_rules`, may select. Positions are
seeded; the writes below have no handlers yet.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/circle-member/position.add` | ordered | who holds which role |
| `POST /api/circle-member/position.remove` | ordered | who holds which role |

- **position.add** and **position.remove** change who holds a role in a
  circle, and so who may use the powers a mandate grants it. Spending
  writes read positions through `cella.may`, so they are ordered.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| position.add, position.remove | held by the circle, by decision; the manager's election is the assembly's | each circle for its own seats |
