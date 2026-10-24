+++
title = "Ledger"
updated = 2026-10-24
+++

The double-entry books: a chart of accounts and balanced journal entries. Nothing is ever edited; a correction is a new entry.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/ledger/entry.credit` | confluent | deposits merge |
| `POST /api/ledger/entry.debit` | bounded | from a share; beyond it, ordered |
| `POST /api/ledger/entry.adjust` | ordered | a correction, which needs a decision |
| `POST /api/ledger/period.close` | ordered | nothing posts into a closed period |

## Domain

To port from seedling's `specs/feat/15-transactions.md`, under this repo's labels and grafts.
