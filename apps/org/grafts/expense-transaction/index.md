+++
title = "expense-transaction"
updated = 2026-10-24
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

## Rules

- `expense_transaction.charged`, on `expense:expense:approve`, and
  `.paid`, on `expense:expense:reimburse`: the expense has a posting for
  the event, dated on it, whose lines are exactly the event's.

## Handlers

`approve` and `reimburse` wrap the expense feat's specs: the expense's
state, then the entry through the transaction feat's `record`, then the
posting, then `cella.submit` once.

## Shell

Replaces the expense feat's approve and reimburse with these, and adds an
expense's postings to its page.
