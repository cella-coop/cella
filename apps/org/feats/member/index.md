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

## Schema

`member` (`core/sql/`): `member.member`, one row per address, with name, status (`invited`, `active`, `suspended`, `exited`), `since` and shares. A trigger lets a status move only along that lifecycle, raising SQLSTATE `09000` otherwise. The app role may select, insert and update; the rules role, `cella_rules`, may select.

## Rules

- `member.admitted`, on `member:member:admit`: the write left the member active, since the verdict date, holding shares.

Whether the cited decision asks to admit the member is the `decision-member` graft's rule on the same op; whether it closed and passed on its roll, `circle-decision-member`'s.

## Handlers

- `admit` (ordered): sets the member active since `cella.verdict_date()` with their shares, then submits `{ member, shares, decision }`; the cited decision is an id this feat does not resolve.

## Grafts

- `decision-member`

## Domain

To port from seedling's `specs/feat/10-members.md`, under this repo's labels and grafts.
