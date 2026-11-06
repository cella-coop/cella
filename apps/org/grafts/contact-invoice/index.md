+++
title = "contact-invoice"
updated = 2026-11-06
+++

Who an invoice bills. An invoice without a link is unbilled, not invalid;
it still carries the name it bills as text.

## Schema

`contact_invoice` (`sql/`):

- `contact_invoice.billing`: an invoice and the contact it bills, by id, with
  no foreign key into either feat. A trigger refuses an invoice or a contact
  that does not exist (SQLSTATE `09000`).
- `contact_invoice.standing`: what each contact owes and is owed, in cents,
  summed from `invoice.standing`. `credit` is what the co-op owes back:
  Vélo Solidaire's overpayment on F-2026-0051 shows here. It reads as its reader, so it shows only the records its reader reads.

The app role may select, insert and update; the guards role, `cella_guards`,
may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/contact-invoice/link` | confluent | the last writer wins; an invoice bills one contact |

- **link** links an invoice to a contact, or moves the link.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| link | `issue-invoice`: linking an invoice to whom it bills is invoicing | Julien, as finance |

`002-powers.sql` registers it in `cella.power`, and the membership
feat checks it.

## Shell

Adds to an invoice's page the contact it bills, or that it is unbilled,
with the form that links it (`link`); and to the contacts what each owes,
from `contact_invoice.standing`, and to a contact's page the invoices that
bill it.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `contact_invoice.billings` to the analytics shell: which contact each invoice is billed to. It is scoped by `circle`, the circle that owns each row.
