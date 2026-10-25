+++
title = "account-transaction"
updated = 2026-10-25
+++

A transaction's lines post to accounts. The graft resolves each line's
account code, refuses an entry dated in a closed period, keeps money from
leaving a cash account except through the writes with their own power and
limit, posts a surplus allocation's split, and draws the financial
statements from the journal.

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
- `account_transaction.figures(sheet, since, until)`: each account's
  figure on a sheet over a span, its lines dated from `since` (from the
  start when null) to `until`, signed by the side of the rubric the
  account feat places it in; `statement(sheet, since, until)`, the sheet
  rubric by rubric in its order, a line the sum of its accounts, a total
  what it adds less what it subtracts, expanded down to its lines, a
  heading none. The income statement is drawn over a span, the balance
  sheet over every entry up to its last day. The sums are SQL's; the shell
  only sets a span beside the one before it.

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
`expense.reimburse`, an expense paid back; `payslip:run.pay`, a pay run.

- `account_transaction.cashless`, on `transaction:transaction:post`: the
  entry posts to no cash account, in or out. Keeping the books is not
  moving money.
- `account_transaction.restores`, on `transaction:transaction:adjust`: the
  entry credits no cash account by more than the entry it corrects
  debited it, so a correction returns cash and never pays it out.
- `account_transaction.allocated`, on `account:surplus:allocate`: the
  allocation posted one entry, dated the day it was allocated, which
  posts every line of its split. A write posts one entry, so what a graft
  above posts in the same write, such as the shares the work share buys,
  is lines of that entry: they balance among themselves and touch neither
  the result (`120`) nor a cash account, and the graft that adds them
  checks they are exactly its own (`004-allocated.sql`).
- `account_transaction.reserves`, on `account:surplus:allocate`: at least
  15 % of the surplus goes to the legal reserve until the reserve, read
  before this allocation, reaches the highest amount the capital ever
  reached (loi n° 78-763 du 19 juillet 1978, art. 33, 1°).

Money received posts through the writes that receive it, such as
`invoice.payment`.

## Carrying the books over

A co-op switching to cella brings its books from its last tool as a FEC,
the file every French accounting tool exports (Livre des procédures
fiscales, art. L47 A and A47 A-1). Each of its entries is carried over by
`account-transaction:entry:carry` (confluent, `carry-books`): the accounts
it names that the chart lacks, opened of the kind their class makes them
(`account.kind_of`), and the entry recorded, in one write. Its opening
balances are the à-nouveaux entry, dated in the first open month. Unlike a
post, a carried entry may touch a cash account, since it records money
that moved before cella; so it needs a power of its own, which no mandate
to keep the books grants by itself. The journal's triggers still refuse
an entry that does not balance or falls in no open period.

- `account_transaction.carries`, on `account-transaction:entry:carry`:
  the entry the payload names is in the journal on its date with its
  lines, and each account the payload names as opened is in the chart, of
  its class's kind.

The FEC is read by this graft's importer, `fec`, one carry for each
entry, by its journal and number ([import](../../feats/import/index.md)).

## Handlers

`allocate` (ordered, `decided`) wraps the account feat's `allocating`:
the allocation marked, then its entry through the transaction feat's
`record`, then the link, then `cella.submit` once. `carry` opens the
accounts through the account feat's `opening`, then records the entry
through the transaction feat's `record`.

## Tests

`ts/_tests/allocation.test.ts` (`cella test slice account-transaction`):
an allocation's lines, and the legal reserve's 15 % owed while it is under
the highest capital, and not once it reaches it, even after the capital
fell.
`ts/_tests/statements.test.ts`: from a small journal, the income
statement sums a span's entries, its result the income less the expenses,
two months adding up to both; the balance sheet balances at every end,
its result of the period the income statement's; a line's accounts add
up to it.

## Shell

Adds each account's debits, credits and balance to the chart, from
`account_transaction.balance`, with whether the trial balance agrees as
the collection's status, and the chart's dashboard: the debits, the
credits, the cash the cash accounts hold and the balance by kind; an
account's ledger, every line posted to it, to its page; to an
allocation's page the entry it posted, and its `allocate` write; and to
the account feat's `reports`, each span's result and total assets, and on
a span's page two tabs, the income statement and the balance sheet
(`Sheet`), each rubric with the span's figure and the span before's, a
line nothing posted to in either left out, and a line opening on its
accounts, each linking to its ledger.

## Lanterne

July to September 2026 are closed; October to December are open. The
seeded books give the bank, `512`, its one cash account, 39 296 € and
clients 57 180 €. A post touching `512` is refused; Julien pays suppliers
through pay. The legal reserve, 9 000 €, is under the capital, 13 000 €,
so the 2025 split owes it 15 %. The statements: a loss of 22 860 € over the
third quarter, which paid three months' wages against two quarters'
invoices, and of 80 € over 2026 so far; a balance sheet of 97 080 €,
with the 2025 result of 61 400 € still to allocate.
