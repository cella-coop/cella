+++
title = "account-transaction"
updated = 2026-10-24
+++

A transaction's lines post to accounts. The graft resolves each line's
account code, refuses an entry dated in a closed period, keeps money from
leaving a cash account except through the writes with their own power and
limit, and posts a surplus allocation's split.

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
- `account_transaction.allocation`: the entry each allocation posted;
  `allocation_lines(allocation)`, its split as lines: the year's result,
  `120`, debited by the surplus, and the work share credited to `424`,
  the legal reserve to `1061`, the development fund to `1068` and the
  interest on capital to `457`; `capital(day)`, the capital, every account
  of class 101, on a day.

The app role and the rules role, `cella_rules`, may select the balance and
the allocations; the app role may insert an allocation's entry.

## Rules

The open-period rule is a trigger rather than a rule `submit` runs, since
it holds for every write that posts, whatever its op. At rung 2 a late
post is re-dated into the first open period and flagged, instead of
refused.

An account the chart marks `cash` (the account feat's flag) holds the
co-op's money, and money leaves one only through the writes with their own
power or right and a rule that checks the entry is exactly what they say:
`transaction.pay`, a supplier payment; `account.draw`, a member's draw;
`expense.reimburse`, an expense paid back; `payslip.pay`, a pay run.

- `account_transaction.cashless`, on `transaction:transaction:post`: the
  entry posts to no cash account, in or out. Keeping the books is not
  moving money.
- `account_transaction.restores`, on `transaction:transaction:adjust`: the
  entry credits no cash account by more than the entry it corrects
  debited it, so a correction returns cash and never pays it out.
- `account_transaction.allocated`, on `account:surplus:allocate`: the
  allocation posted one entry, dated the day it was allocated, whose lines
  are exactly its split.
- `account_transaction.reserves`, on `account:surplus:allocate`: at least
  15 % of the surplus goes to the legal reserve until the reserve, read
  before this allocation, reaches the highest amount the capital ever
  reached (loi n° 78-763 du 19 juillet 1978, art. 33, 1°).

Money received posts through the writes that receive it, such as
`invoice.payment`.

## Handlers

`allocate` (ordered, `decided`) wraps the account feat's `allocating`:
the allocation marked, then its entry through the transaction feat's
`record`, then the link, then `cella.submit` once.

## Tests

`ts/_tests/allocation.test.ts` (`cella test slice account-transaction`):
an allocation's lines, and the legal reserve's 15 % owed while it is under
the highest capital, and not once it reaches it, even after the capital
fell.

## Shell

Adds each account's debits, credits and balance to the chart, from
`account_transaction.balance`, with whether the trial balance agrees as
the collection's status, and the chart's dashboard: the debits, the
credits, the cash the cash accounts hold and the balance by kind; an
account's ledger, every line posted to it, to its page; and to an
allocation's page the entry it posted, and its `allocate` write.

## Lanterne

July to September 2026 are closed; October to December are open. The
seeded books give the bank, `512`, its one cash account, 39 296 € and
clients 57 180 €. A post touching `512` is refused; Julien pays suppliers
through pay. The legal reserve, 9 000 €, is under the capital, 13 000 €,
so the 2025 split owes it 15 %.
