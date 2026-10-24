+++
title = "Invoice"
updated = 2026-10-24
+++

What the co-op bills: issue an invoice, send it, record what is paid
against it, and void it when it is wrong. An invoice carries everything
that must appear on it as issued, including the name and address it bills,
as text; the link to a client record is the `client-invoice` graft's, and
the entries it posts are the `invoice-transaction` graft's.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| invoice | `id`, `issued`, `due`, `bill_to`, `label`, `lines[]`, `net`, `vat`, `total`, `voided?`, `reason?` | `id` is the series and its number, `F-2026-0056` |
| line | `description`, `quantity`, `unit_price`, `amount`, `vat_rate` | `amount` = quantity × unit price |
| payment | `at`, `amount`, `method`, `reference` | many per invoice; `reference` is the bank's |
| series | `name`, `next` | one per year at rung 1; a device's own at rung 2 |

## Lifecycle

```mermaid
stateDiagram-v2
  direction LR
  draft --> issued: issue
  issued --> sent: send
  issued --> voided: void
  sent --> voided: void
```

`unpaid`, `partial`, `paid` and `overdue` are not states: they are read
from the payments, the total and `due`. A draft has no
number; issuing gives it the next one and freezes it. A voided invoice
keeps its number, and the void posts a credit note.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/invoice/issue` | bounded | numbered in a series; the server's own until rung 2 gives devices theirs |
| `POST /api/invoice/send` | confluent | to a client, or to a peer co-op |
| `POST /api/invoice/payment` | confluent | payments add up |
| `POST /api/invoice/void` | ordered | ordered against the payments |

- **issue** spends a number from a series granted in advance. Until rung 2
  the server holds the only series, so numbers are gapless and
  chronological as French law requires; at rung 2 each device receives a
  series of its own and issues offline.
- **send** delivers the issued invoice, by email or as a signed event to a
  peer co-op at rung 5. Sending twice does no harm.
- **payment** records money received. Payments are facts from the bank;
  they add up in any order, and the same bank reference recorded twice
  merges into one payment. An invoice paid beyond its total is not
  refused: the excess shows as a credit owed to the client, refunded or
  applied elsewhere.
- **void** is ordered against the payments: it settles only if no payment
  was received before it, and posts the credit note.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| issue | `issue-invoice` | Julien, as finance |
| send | `issue-invoice` | Julien |
| payment | `record-receipt` | Julien |
| void | `issue-invoice` | Julien |

Leads quote up to 15 000 € with `send-quote`; a quote is not an invoice
and belongs to the later `project` feat.

## Invariants

The invoice feat owns the rules about its own collection:

- `total` = `net` + `vat`, and `net` is the sum of the lines;
- an issued invoice never changes; a correction is a void and a reissue;
- numbers in a series are unique, gapless and in date order;
- a payment beyond the total is not refused: it leaves a credit owed to
  the client, not an overpaid invoice; the same bank reference recorded
  twice merges into one payment;
- a voided invoice takes no payment and is not sent again.

What it does not own:

- whom the invoice bills as a client record: `client-invoice`;
- that issue, payment and void post balanced entries into an open period:
  `invoice-transaction` and `account-transaction`.

## What it does not know

Invoice knows no clients, transactions, accounts, projects or timesheets.
Generating lines from billable time or milestones belongs to later grafts
with `timesheet` and `project`; e-invoicing through an approved platform
arrives at rung 3.

## Lanterne

- Series F-2026 runs from 0041 to 0055; the next is 0056.
- Clients owe 57 180 €. Compagnie Mauve Horizon's posters (0044, 7 440 €)
  are three months overdue.
- Vélo Solidaire has paid 1 980 € of 0051's 3 960 €: the invoice is
  partial.
- 0050 was voided the day after issue, before any payment, and reissued as
  0051 at the solidarity rate.
