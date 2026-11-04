+++
title = "account-transaction"
updated = 2026-11-04
+++

A transaction's lines post to accounts. The graft resolves each line's
account code, refuses an entry dated in a closed period, keeps money from
leaving a cash account except through the writes with their own power and
limit, and draws the financial statements from the journal.

## Schema

`account_transaction` (`sql/`):

- `account_transaction.posts`, a line check its migration registers by
  the transaction feat's `transaction.register_line_check`, which the
  journal's own trigger runs before each line is inserted, whichever
  write posts it (a transaction's own, or an invoice's through
  `invoice-transaction`): the line's account exists, and its entry's
  month is a period of the books and is open. It reads the period
  row `FOR SHARE`, and `account:period:close` updates it, so a post and a
  concurrent close are serialised. It raises SQLSTATE `09000`, so the
  write is refused and uses no verdict number.
- `account_transaction.balance`: the trial balance, each account's debits,
  credits and signed balance (debit positive) in cents, from the journal;
  `agrees()`, whether the whole journal's debits and credits agree.
- `account_transaction.figures(sheet, since, until)`: each account's
  figure on a sheet over a span, its lines dated from `since` (from the
  start when null) to `until`, signed by the side of the rubric the
  account feat places it in; `statement(sheet, since, until)`, the sheet
  rubric by rubric in its order, a line the sum of its accounts, a total
  what it adds less what it subtracts, expanded down to its lines, a
  heading none. The income statement is drawn over a span, the balance
  sheet over every entry up to its last day. The patronage feat reads a
  year's result from it; the `report` feat draws the same sheets through
  the analytics port, from the movements below, and equals it to the
  cent.

The app role and the guards role, `cella_guards`, may select the balance.

## Guards

The open-period guard is a line check rather than a guard `submit` runs,
since it holds for every write that posts, whatever its action; the
transaction feat's own trigger runs it, never one of this graft's on
the journal. At rung 2 a late
post is re-dated into the first open period and flagged, instead of
refused.

An account the chart marks `cash` (the account feat's flag) holds the
co-op's money, and money leaves one only through the writes with their own
power or right and a guard that checks the entry is exactly what they say:
`transaction.pay`, a supplier payment; `account.draw`, a member's draw;
`expense.reimburse`, an expense paid back; `payslip:run.pay`, a pay run.

- `account_transaction.cashless`, on `transaction:transaction:post`: the
  entry posts to no cash account, in or out. Keeping the books is not
  moving money.
- `account_transaction.restores`, on `transaction:transaction:adjust`: the
  entry credits no cash account by more than the entry it corrects
  debited it, so a correction returns cash and never pays it out.

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

`carry` opens the
accounts through the account feat's `opening`, then records the entry
through the transaction feat's `record`.

## Tests

`ts/_tests/statements.test.ts` (`cella test slice account-transaction`): from a small journal, the income
statement sums a span's entries, its result the income less the expenses,
two months adding up to both; the balance sheet balances at every end,
its result of the period the income statement's; a line's accounts add
up to it.

## Reads

It says whose an account's lines are (`holds`, registered in `cella.reach` for `transaction`, `sql/005-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)): a line on an account no one holds reads for every member, one on a capital account for its holder and capital's readers. `balance` reads as its reader, each account whole where its lines are; `statement` and `agrees` run as their owner, so the statements by rubric and whether the trial balance agrees are the whole journal's for every member, while an account's `figures` read as its lines.

## Shell

Adds each account's debits, credits and balance to the chart, from
`account_transaction.balance`, with whether the whole trial balance agrees
(`agrees`, the collection's `about`) as the collection's status, and the chart's dashboard: the debits, the
credits, the cash the cash accounts hold and the balance by kind; an
account's ledger, every line posted to it, to its page. The financial
statements are the `report` feat's.

## Lanterne

July to September 2026 are closed; October to December are open. The
seeded books give the bank, `512`, its one cash account, 39 296 € and
clients 57 180 €. A post touching `512` is refused; Julien pays suppliers
through pay. The statements: a loss of 22 860 € over the
third quarter, which paid three months' wages against two quarters'
invoices, and of 80 € over 2026 so far; a balance sheet of 97 080 €,
with the 2025 result of 61 400 € still to distribute.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `account_transaction.movements` to the analytics shell: the journal by account and day, what every statement and the trial balance sum. Each line is resolved to its account; a member's capital account is summed into its parent's code, so no row is one member's.
