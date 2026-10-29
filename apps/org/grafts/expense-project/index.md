+++
title = "expense-project"
updated = 2026-10-30
+++

The project an expense was spent for, to bill on to its client; an
expense under no project is the co-op's own. Declared by `expense`.

## Schema

`expense_project` (`sql/`): `rebill`, an expense and its project, each by
id; `spent`, what each project's members spent for it, approved and
pending.

## Writes

`expense-project:expense:rebill` (confluent, `self`): files an expense
under a project, replacing any it was under; the last filing wins.

## Rules

- `expense_project.files`, on the write: the expense is the actor's own,
  neither refused nor reimbursed, and the project exists and is not
  archived.

## Shell

Adds an expense's project to the list, the co-op where it is under none,
and to its page, with the form to file it; and to a project's page, an
Expenses tab of what was spent for it.

## Lanterne

Sofia's print proofs are billed on to Maison Ferrand's packaging,
Thomas's train to Clairval's site, Chloé's coffee to Nuvola's retainer.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `expense_project.rebills` to the analytics shell: which project each expense is rebilled to; and `expense_project.totals`, each project's expenses, approved and reimbursed or still pending, in cents.
