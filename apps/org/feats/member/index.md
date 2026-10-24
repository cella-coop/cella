+++
title = "Member"
updated = 2026-10-24
+++

A person's membership, from invited to exited. Members records who belongs; it decides nothing.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/member/invite` | confluent | a fact; two invitations do no harm |
| `POST /api/member/admit` | ordered | changes who votes |
| `POST /api/member/profile` | confluent | a member's own fields |
| `POST /api/member/suspend` | ordered | changes who votes |
| `POST /api/member/exit` | ordered | freezes the capital account |

## Grafts

- `decision-member`

## Domain

To port from seedling's `specs/feat/10-members.md`, under this repo's labels and grafts.
