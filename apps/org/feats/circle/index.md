+++
title = "Circle"
updated = 2026-10-24
+++

Nested units of the co-op, with their positions, roles and mandates. Nesting refuses a cycle.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/circle/nest` | ordered | two offline nestings can form a cycle |
| `POST /api/circle/position.add` | ordered | who holds which role |
| `POST /api/circle/position.remove` | ordered | who holds which role |
| `POST /api/circle/mandate.grant` | ordered | authority, with limits such as maxAmount |
| `POST /api/circle/mandate.revoke` | ordered | authority, with limits such as maxAmount |
| `POST /api/circle/message` | confluent | the circle's channel |

## Grafts

- `circle-member`

## Domain

To port from seedling's `specs/feat/03-circles.md`, under this repo's labels and grafts.
