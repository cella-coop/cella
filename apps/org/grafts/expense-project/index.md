+++
title = "expense-project"
updated = 2026-11-19
+++

The project an expense was spent for, to bill on to its client; an
expense under no project is the coop's own. Declared by `expense`.

## Schema

`expense_project` (`sql/`): `rebill`, an expense and its project, each by
id; `spent`, what each project's members spent for it, approved and
pending. `spent` sums every expense filed on a project for every reader, declared `audience: shared by project`.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

`expense-project:expense:rebill` (confluent, `claim-expense`, every employee's right): files an expense
under a project, replacing any it was under; the last filing wins.

## Guards

- `expense_project.files`, on the write: the expense is the actor's own,
  neither refused nor reimbursed, and the project exists and is not
  archived.

## Folds

A filing folds by `sql/002-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)): the expense
its entry names under its project, replacing any it was under, as its
payload, the expense and the project, keeps them.

## Tests

`ts/_tests/folds.test.ts` (`cella test slice expense-project`): an
expense folds filed under its entry's project, the last filing winning.

## Shell

Adds an expense's project to the list, the coop where it is under none,
and to its page, a panel of its overview with the form to file it; and to a project's Budget
tab, what was spent for it.

## Lanterne

Sofia's print proofs are billed on to Maison Ferrand's packaging,
Thomas's train to Clairval's site, Chloé's coffee to Nuvola's retainer.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `expense_project.rebills` to the analytics shell: which project each expense is rebilled to; and `expense_project.totals`, each project's expenses, approved and reimbursed or still pending, in cents. `expense_project.rebills` is scoped by `circle`, the circle that owns each row, and `expense_project.totals` is shared by `project`. `expense_project.totals` is counted: `expense_project.totals_contributions` holds what each person filed on each project, read by expense's powers, which only the port reads, to withhold a project from a reader where open books does not share it ([what is withheld](../../core/analytics/index.md#what-is-withheld)). Each of its views but the contributions is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
