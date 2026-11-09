+++
title = "contact-invoice"
updated = 2026-11-09
+++

Who an invoice bills: a client, a contact holding the client role
([contact](../../feats/contact/index.md#the-client-role)). An invoice
without a link is unbilled, not invalid; it still carries the name it
bills as text. The invoice copies the name and address it bills when it
is issued, so a contact's later update never changes an issued invoice,
and the link changes nothing printed on it.

## Schema

`contact_invoice` (`sql/`):

- `contact_invoice.billing`: an invoice and the contact it bills, by id, with
  no foreign key into either feat. A trigger refuses an invoice or a contact
  that does not exist, and a contact that is no client, naming it and
  saying to set its client role (SQLSTATE `09000`), so a refused link
  leaves no row.
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
| `POST /api/contact-invoice/link` | confluent | the last writer wins; an invoice bills one client |

- **link** links an invoice to a client, or moves the link; a contact
  that is no client is refused.

## Folds

A link folds by `sql/003-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
the invoice linked to the contact its entry names, or moved to it.

## Invariants

- a billing's invoice and contact exist, and the contact is a client
  when the link is made.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| link | `issue-invoice`: linking an invoice to whom it bills is invoicing | Julien, as finance |

`002-powers.sql` registers it in `cella.power`, and the membership
feat checks it.

## Shell

Adds to an invoice's page the client it bills, or that it is unbilled,
with the form that links it (`link`), whose picker offers the clients
not archived and no other contact; and to the contacts what each owes,
from `contact_invoice.standing`, and to a contact's page, in an Invoices tab, the invoices
that bill it.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `contact_invoice.billings` to the analytics shell: which contact each invoice is billed to. It is scoped by `circle`, the circle that owns each row.
