+++
title = "account-transaction"
updated = 2026-10-24
+++

A transaction's lines post to accounts. The graft resolves each line's
account code and refuses an entry dated in a closed period.

## Schema

`account_transaction` (`sql/`):

- `account_transaction.posts`, a trigger before each journal line is
  inserted, whichever write posts it (a transaction's own, or an invoice's
  through `invoice-transaction`): the line's account exists, and its
  entry's month is a period of the books and is open. It reads the period
  row `FOR SHARE`, and `account:period:close` updates it, so a post and a
  concurrent close are serialised. It raises SQLSTATE `09000`, so the
  write is refused and uses no verdict number.
- `account_transaction.balance`: the trial balance, each account's debits,
  credits and signed balance (debit positive) in cents, from the journal.

The app role and the rules role, `cella_rules`, may select the balance.

## Rules

The open-period rule is this trigger rather than a rule `submit` runs:
`transaction.post` and `invoice.payment` are confluent, and confluent
writes skip the rule check, yet every post must meet it. At rung 2 a late
post is re-dated into the first open period and flagged, instead of
refused.

## Lanterne

July to September 2026 are closed; October is open. The seeded books give
the bank 39 296 € and clients 57 180 €.
