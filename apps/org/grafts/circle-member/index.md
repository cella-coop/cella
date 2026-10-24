+++
title = "circle-member"
updated = 2026-10-24
+++

Positions: which member holds which role in which circle. A position is
the relationship, so the graft owns its writes.

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
