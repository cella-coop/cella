+++
title = "client-invoice"
updated = 2026-10-30
+++

Who an invoice bills. An invoice without a link is unbilled, not invalid;
it still carries the name it bills as text.

## Schema

`client_invoice` (`sql/`):

- `client_invoice.billing`: an invoice and the client it bills, by id, with
  no foreign key into either feat. A trigger refuses an invoice or a client
  that does not exist (SQLSTATE `09000`).
- `client_invoice.standing`: what each client owes and is owed, in cents,
  summed from `invoice.standing`. `credit` is what the co-op owes back:
  Vélo Solidaire's overpayment on F-2026-0051 shows here.

The app role may select, insert and update; the rules role, `cella_rules`,
may select.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/client-invoice/link` | confluent | the last writer wins; an invoice bills one client |

- **link** links an invoice to a client, or moves the link.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| link | `issue-invoice`: linking an invoice to whom it bills is invoicing | Julien, as finance |

`002-powers.sql` registers it in `cella.power`, and the `circle-membership`
graft checks it.

## Shell

Adds to an invoice's page the client it bills, or that it is unbilled,
with the form that links it (`link`); and to the clients what each owes,
from `client_invoice.standing`, and to a client's page the invoices that
bill it.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `client_invoice.billings` to the analytics shell: which client each invoice is billed to.
