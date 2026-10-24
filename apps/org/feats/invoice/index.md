+++
title = "Invoice"
updated = 2026-10-24
+++

Issue, send and get paid.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/invoice/issue` | bounded | numbered in a series; the server's own until rung 2 gives devices theirs |
| `POST /api/invoice/send` | confluent | to a client, or to a peer co-op |
| `POST /api/invoice/payment` | confluent | payments add up |
| `POST /api/invoice/void` | ordered | ordered against the payments |

## Grafts

- `client-invoice`
- `invoice-ledger`

## Domain

To port from seedling's `specs/feat/08-invoices.md`, under this repo's labels and grafts.
