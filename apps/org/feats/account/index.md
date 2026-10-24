+++
title = "Account"
updated = 2026-10-24
+++

The co-op's accounts: the chart of accounts, members' capital accounts, reserves and funds, the periods they are kept in, and their balances. An account holds no balance of its own; its balance is read from the transactions posted to it.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/account/draw` | bounded | from a member's share; beyond it, ordered |
| `POST /api/account/surplus.allocate` | ordered | the assembly's decision splits the surplus |
| `POST /api/account/period.close` | ordered | nothing posts into a closed period |

## Grafts

- `account-decision`

## Domain

To port from seedling's `specs/feat/01-accounts.md`, under this repo's labels and grafts.
