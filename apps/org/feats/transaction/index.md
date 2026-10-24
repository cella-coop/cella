+++
title = "Transaction"
updated = 2026-10-24
+++

The journal: balanced entries, each a set of lines that debit and credit accounts. Nothing is ever edited; a correction is a new entry. A line names its account by its code, and the `account-transaction` graft resolves it.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/transaction/credit` | confluent | deposits merge |
| `POST /api/transaction/debit` | bounded | from a share; beyond it, ordered |
| `POST /api/transaction/adjust` | ordered | a correction, which needs a decision |

## Grafts

- `account-transaction`

## Domain

To port from seedling's `specs/feat/15-transactions.md`, under this repo's labels and grafts.
