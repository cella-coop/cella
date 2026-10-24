+++
title = "account-transaction"
updated = 2026-10-24
+++

A transaction's lines post to accounts. The graft resolves each line's
account code, refuses an entry dated in a closed period, and keeps money
from leaving a cash account except through the writes with their own
power and limit.

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

The open-period rule is a trigger rather than a rule `submit` runs, since
it holds for every write that posts, whatever its op: a transaction's own
and an invoice's through `invoice-transaction`. At rung 2 a late post is
re-dated into the first open period and flagged, instead of refused.

An account the chart marks `cash` (the account feat's flag) holds the
co-op's money, and money leaves one only through `transaction.pay` and
`transaction.payroll`, each with its own power, whose feat's rules check
the entry is exactly a payment or a payroll:

- `account_transaction.cashless`, on `transaction:transaction:post`: the
  entry posts to no cash account, in or out. Keeping the books is not
  moving money.
- `account_transaction.restores`, on `transaction:transaction:adjust`: the
  entry credits no cash account by more than the entry it corrects
  debited it, so a correction returns cash and never pays it out.

Money received posts through the writes that receive it, such as
`invoice.payment`.

## Shell

Adds each account's debits, credits and balance to the chart, from
`account_transaction.balance`, with the trial balance over them and the
cash the cash accounts hold; and an account's ledger, every line posted
to it, to its page.

## Lanterne

July to September 2026 are closed; October is open. The seeded books give
the bank, `512`, its one cash account, 39 296 € and clients 57 180 €. A
post touching `512` is refused; Julien pays suppliers through pay and
runs the payroll through payroll.
