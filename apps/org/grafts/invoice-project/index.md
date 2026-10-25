+++
title = "invoice-project"
updated = 2026-10-25
+++

Which project an invoice bills work of. An invoice that names no project
is not invalid; it still says what it bills in its label. Declared by
`invoice`.

## Schema

`invoice_project` (`sql/`):

- `invoice_project.charge`: an invoice and its project, by id, with no
  foreign key into either feat. A trigger refuses an invoice or a project
  that does not exist (SQLSTATE `09000`).
- `invoice_project.invoiced`: what each project invoiced, net of VAT, its
  voided invoices left out, in cents.

The app role may select, insert and update; the rules role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `invoice-project:invoice:link` | confluent | `issue-invoice` | the last writer wins; an invoice bills one project's work |

On an invoice's page the write is the action `charge`, apart from
`client-invoice`'s `link` on the same page. `002-powers.sql` registers
the power in `cella.power`, and the `circle-membership` graft checks it.

## Invariants

- a charge's invoice and project exist.

That the project is for the client the invoice bills joins three feats and
is not checked in SQL; the fixture check holds Lanterne to it.

## Shell

Adds to an invoice's page its project and the form that names it; to a
project's overview what it invoiced and its invoices.

## Lanterne

Each of the fifteen invoices names its project: the Halles shop's
milestones 1 to 3 (36 000 € net), Nuvola's four monthly retainers, Vélo
Solidaire's voided invoice and its reissue at the solidarity rate.
