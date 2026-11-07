+++
title = "invoice-project"
updated = 2026-11-07
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
  voided invoices left out, in cents. It sums every invoice charged to a project for every reader, declared `audience: shared by project`.

The app role may select, insert and update; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `invoice-project:invoice:link` | confluent | `issue-invoice` | the last writer wins; an invoice bills one project's work |

On an invoice's page the write is the action `charge`, apart from
`contact-invoice`'s `link` on the same page. `002-powers.sql` registers
the power in `cella.power`, and the membership feat checks it.

## Folds

A link folds by `sql/003-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
the invoice charged to the project its entry names, or moved to it.

## Invariants

- a charge's invoice and project exist.

That the project is for the contact the invoice bills joins three feats and
is not checked in SQL; the fixture check holds Lanterne to it.

## Shell

Adds to an invoice's page its project and the form that names it; to a
project's overview what it invoiced and its invoices.

## Lanterne

Each of the fifteen invoices names its project: the Halles shop's
milestones 1 to 3 (36 000 € net), Nuvola's four monthly retainers, Vélo
Solidaire's voided invoice and its reissue at the solidarity rate.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `invoice_project.charges` to the analytics shell: which project each invoice charges; and `invoice_project.totals`, what each project invoiced, net of VAT and of its voided invoices. `invoice_project.charges` is scoped by `circle`, the circle that owns each row, and `invoice_project.totals` is shared by `project`.
