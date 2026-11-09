+++
title = "expense-transaction"
updated = 2026-11-13
+++

An expense's approval and its reimbursement post balanced entries, in the
same database transaction as the expense write and under the same
verdict. Declared by `expense`.

## Postings

For a French SCOP's chart:

| Event | Debit | Credit |
|---|---|---|
| approval (charge) | its category (`6xx`), before VAT; `44566` deductible VAT, the VAT | `421`, what is owed the member, the total |
| reimbursement (payment) | `421`, the total | `512` the bank, the total |

## Schema

`expense_transaction` (`sql/`): `posting`, the entry, the expense and the
event, one of each per expense; `lines(expense, event)`, the lines an
event posts, which the handlers ask the database for.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `expense_transaction.charged`, on `expense:expense:approve`, and
  `.paid`, on `expense:expense:reimburse`: the expense has a posting for
  the event, dated on it, whose lines are exactly the event's.

## Folds

An expense's approval and its reimbursement fold by `sql/002-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)), once the
expense feat's fold has moved the expense: the entry each posted, as its
payload keeps it, its date, its label and its lines (`logged`), linked
as the event it is.

## Handlers

`approve` and `reimburse` wrap the expense feat's specs: the expense's
state, then the entry through the transaction feat's `record`, then the
posting, then `cella.submit` once. Each payload keeps the entry it
posted, for its fold.

## Tests

`ts/_tests/folds.test.ts` (`cella test slice expense-transaction`): a
charge and a payment fold the entries their payloads keep, each linked
as its event, and one that keeps none is refused.

## Shell

Replaces the expense feat's approve and reimburse with these, and adds an
expense's postings to its page in a Postings tab.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `expense_transaction.postings` to the analytics shell: which entry posted which expense, and on what event. It is scoped by `circle`, the circle that owns each row. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
