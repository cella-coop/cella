+++
title = "bill-transaction"
updated = 2026-11-05
+++

A bill's approval and its payment post balanced entries, in the same
database transaction as the bill write and under the same verdict.
Declared by `bill`.

## Postings

For a French SCOP's chart:

| Event | Debit | Credit |
|---|---|---|
| approval (charge) | its category (`6xx`), the net; `44566` deductible VAT, the VAT | `401` suppliers, the total |
| payment | `401`, the total | `512` the bank, the total |

The charge moves the income statement by the bill's net, the day it is
approved; the payment moves only the balance sheet.

## Schema

`bill_transaction` (`sql/`): `posting`, the entry, the bill and the
event, one of each per bill; `lines(bill, event)`, the lines an event
posts, which the handlers ask the database for, so the postings are
SQL's, never TypeScript's.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `bill_transaction.charged`, on `bill:bill:approve`, and `.paid`, on
  `bill:bill:pay`: the bill has a posting for the event, dated on it,
  whose lines are exactly the event's.

That the entry lands in an open period is `account-transaction`'s.

## Handlers

`approve` and `pay` wrap the bill feat's specs: the bill's state, then
the entry through the transaction feat's `record`, then the posting,
then `cella.submit` once. A refusal by any guard or trigger rolls all of
it back.

## Shell

Replaces the bill feat's approve and pay with these, and adds a bill's
postings, line by line, to its page.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `bill_transaction.postings` to the analytics shell: which entry posted which bill, and on what event. It is scoped by `circle`, the circle that owns each row.
