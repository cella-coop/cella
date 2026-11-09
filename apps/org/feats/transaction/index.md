+++
title = "Transaction"
updated = 2026-11-09
+++

The journal: every movement of money in the co-op, as balanced
double-entry entries. An entry is a set of lines, each debiting or
crediting one account by its code; its debits equal its credits. Nothing in
the journal is ever edited or deleted: a correction is a new entry that
reverses or adjusts an earlier one. The journal is the single source of
truth for balances, which are summed from it and never stored.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| entry | `id`, `date`, `label`, `lines[]`, `corrects?` | `date` is the accounting date; `corrects` names an earlier entry of this journal |
| line | `account`, `debit` or `credit` | amounts in positive cents; `account` is a code, as text |

A line names its account by code and holds no key into `account`; the
`account-transaction` graft resolves the code and refuses one that does not
exist. Where an entry came from (an invoice, a distribution, a payroll run)
is the producing graft's junction, not a field here: the journal records
what happened, the grafts record why.

## Lifecycle

An entry is posted once and is then permanent. There are no drafts in the
journal: a draft belongs to the feat that produces the entry (an invoice
before issue, a distribution before its approval).

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/transaction/post` | confluent | an entry always has both sides |
| `POST /api/transaction/pay` | confluent | a payment to a supplier is an entry like any other |
| `POST /api/transaction/adjust` | ordered | a correction, named by the entry it corrects |

- **post** posts a balanced entry that touches no cash account: it keeps
  the books and moves no money. An entry's balance is checked on the
  entry alone, so sums of entries commute and two posts settle in any
  order and never wait. The right to take money out of a
  share is `account.draw`'s, not this write's; it posts through
  `account-transaction`.
- **pay** pays a supplier with no bill behind it: one entry debiting
  `401` (fournisseurs) and crediting `512` (the bank) by the amount paid;
  a recorded bill is paid by the bill's own write. It commutes as any entry
  does; what it takes from the bank is capped by the payer's mandate.
- **adjust** posts a correcting entry, naming the entry it corrects
  (`base: 'corrected'`): the notary refuses a second correction of the
  same entry. Whether a correction also needs the circle's motion is a
  circle setting, not part of the write's label.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| post | `record-entry`, with no limit | Julien, as finance |
| pay | `pay-supplier`, within the mandate's limit for the amount paid | Julien, as finance, up to 3 000 € a payment |
| adjust | `record-entry`, with no limit; it may credit a cash account only to undo what it corrects | Julien, as finance |

`003-powers.sql` registers post's power in `cella.power`, and
`004-pay.sql` pay's, with `amount` as the payload field the limit caps,
and `006-adjust.sql` adjust's; the membership feat checks them.
Payroll is not this feat's: a month's pay posts through the `payslip`
feat's runs, by `payslip-transaction`.
Keeping the books is a duty, so a VAT return or an accrual posts under
`record-entry` whatever its size. Every member reads the books; reading
needs no power.

## Invariants

The transaction feat owns the guards about entries alone:

- every entry balances: its debits equal its credits;
- every amount is positive, in cents (`cella.amount`); a line is a debit
  or a credit, never both, never zero;
- an entry, once posted, never changes;
- an entry corrects only an entry of this journal.

What it does not own:

- that a line's account exists and its period is open, that a post
  touches no cash account and that a correction pays no cash out: the
  `account-transaction` graft's, since which accounts are cash is the
  chart's;
- that an invoice's issue, payments and void post the right entries: the
  `invoice-transaction` graft's;
- the writes that take money out of the bank besides `pay`: a member's
  draw (`account-membership-transaction`), an expense reimbursed
  (`expense-transaction`), a supplier's bill paid (`bill-transaction`)
  and a pay run paid (`payslip-transaction`), each
  posting through `record` under its own right and guard.

## What it does not know

Transaction knows no accounts beyond their codes, and no invoices,
members, distributions or periods. It does not know a period is closed; the
graft does. VAT returns and statutory exports such as the FEC read the
journal at rung 3.

## Schema

`transaction` (`core/sql/`):

- `transaction.entry`: id (`je-0041`, gapless, its number four digits or
  more, so `je-10000` follows `je-9999`), date, label,
  `corrects` and the receipt it was posted at; an entry carried over from
  before the log has no receipt.
- `transaction.line`: the entry, its line number, the account code, a
  side (`debit` or `credit`) and one positive `cella.amount`.

A deferred constraint trigger checks that every entry balances over two
lines or more; the db library makes it immediate before the verdict, so an
unbalanced entry is refused inside the write. Another trigger refuses any
update or delete: the journal is permanent. A third numbers each entry
(below). A fourth runs, before each line is inserted, whichever write
posts it, every check an extender registered by
`transaction.register_line_check(check, owner)`, the feat's published
register, each a function of the line, `(transaction.line) → void`,
that raises to refuse it, in the order of their owners and names, each
called by its schema-qualified name with the line cast to
`transaction.line`, so a check overloaded under its name runs the
overload registered and refuses no line it was not asked to; the
feat knows none of its extenders by name, and no extender puts a
trigger on the journal. All raise SQLSTATE `09000`.
`transaction.line_check` is that register, a registry the extenders'
migrations fill through the function and never insert into.
The app role may select and insert; the guards role, `cella_guards`, may
select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`transaction.journal`, the counter, is a registry and names none.

## Guards

- `transaction.corrects`, on `transaction:transaction:adjust`: the entry
  corrects the entry the payload names, and that entry's latest correction
  before it is the payload's `base`; a second correction from the same base
  is refused.
- `transaction.pays`, on `transaction:transaction:pay`: the entry is two
  lines, `401` debited and `512` credited, each by the payload's `amount`,
  so the mandate's limit caps what left the bank.

## Folds

A post, a payment to a supplier and a correction fold by
`transaction.fold_post` (`sql/009-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)): the entry the payload names, posted
as the log keeps it. Every write that posts, this feat's or a graft's,
carries its entry in its payload as `logged` gives it, its date, its
label and its lines, as the journal shows them; `transaction.fold_record`
posts it again under its id, which the journal's trigger refuses unless
it is the next, with the receipt of the write its entry is in
(`transaction.receipt_of`). A graft's fold calls it as its handler
calls `record`.

## Handlers

- `record(tx, entry)`: writes an entry and its lines inside a write's
  transaction. Grafts that post, such as `invoice-transaction`, use it.
- `post` (confluent): records a balanced entry. At rung 1 it is still
  refused when it does not balance or is dated in a closed period, so it
  returns `Refused` beside `Settled`.
- `pay` (confluent): records a supplier payment, `401` against `512`, and
  commits its amount; refused beyond the payer's limit.
- `adjust` (ordered, `base: 'corrected'`): records a correcting entry,
  naming the entry it corrects and the base it read.

Entry ids are gapless, as the FEC export at rung 3 requires a continuous
journal. A trigger numbers each entry from `transaction.journal`, a counter
row the write locks until it commits, as `submit` locks the log's head; a
refused write rolls the counter back with everything else, so it leaves no
gap. An entry that names its own id, as the seed's carried-over entries
do, must name the next number.

## Tests

`core/ts/_tests/journal.test.ts`, the feat's slice test (`cella test
slice transaction`), runs on the app's core and this feat alone: an entry
balances or is refused, ids are gapless and a refused entry returns its
number, nothing posted changes, `transaction.pays` takes a payment and
nothing else, `transaction.corrects` refuses a second correction from the same base,
and the journal numbers on past four digits, `je-10000` after `je-9999`.

## Reads

Every entry and line reads for whoever holds `record-entry`, `carry-books` or `close-period` (`sql/007-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)). A graft that knows whose an account is opens its lines further: `account-transaction` opens the co-op's own accounts' lines to every member and a capital account's to its holder. An entry reads wherever one of its lines does, and its amount, `transaction.amount`, counts every line, read or not. Alone, without that graft, only the books' keepers read the journal. A write's transaction reads it whole, as the guards do.

## Shell

The journal, as the `transactions` collection, the latest entry first,
each with the sum of its debits; an entry's page, its header's crumb its id,
is titled by its label, links the entries that correct it and holds its
lines in its Lines tab. `/journal` and its entries' old addresses
redirect there. Posting
from the shell is not offered: the pilot's entries come from invoices,
bills and expenses, through their grafts.

## Lanterne

- Forty entries from 1 July to 24 October 2026, `je-0001` to `je-0040`.
- `je-0001` carries the opening balances over from the previous tool: the
  bank at 92 000 €, each member's capital, the reserves and the 2025
  result, 61 400 €, not yet distributed, against it.
- Each invoice posts an entry on issue (`411` against `706` and `44571`)
  and one per payment (`512` against `411`). `je-0026` is the credit note
  that voided F-2026-0050.
- July to September's pay runs were carried over as one entry a month,
  `je-0009`, `je-0019` and `je-0031` (`641` and `645` against `512`),
  which `payslip-transaction` links to their runs; October's run posts
  through the payslip feat.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `transaction.months` to the analytics shell: the transaction feat's analytical contract. A line on a member's capital account is theirs, and only the account-transaction graft knows which accounts are held, so the journal shows here only as sums over every line: each month's entries and what they moved. It is shared by `month`.
