+++
title = "Transaction"
updated = 2026-10-24
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
exist. Where an entry came from (an invoice, an allocation, a payroll run)
is the producing graft's junction, not a field here: the journal records
what happened, the grafts record why.

## Lifecycle

An entry is posted once and is then permanent. There are no drafts in the
journal: a draft belongs to the feat that produces the entry (an invoice
before issue, an allocation before its decision).

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/transaction/post` | confluent | an entry always has both sides |
| `POST /api/transaction/pay` | confluent | a payment to a supplier is an entry like any other |
| `POST /api/transaction/payroll` | confluent | a month's payroll is an entry like any other |
| `POST /api/transaction/adjust` | ordered | a correction, named by the entry it corrects |

- **post** posts a balanced entry that touches no cash account: it keeps
  the books and moves no money. An entry's balance is checked on the
  entry alone, so sums of entries commute and two posts settle in any
  order and never wait. The right to take money out of a
  share is `account.draw`'s, not this write's; it posts through
  `account-transaction`.
- **pay** pays a supplier: one entry debiting `401` (fournisseurs) and
  crediting `512` (the bank) by the amount paid. It commutes as any entry
  does; what it takes from the bank is capped by the payer's mandate.
- **payroll** runs a month's payroll: one entry debiting wages (`641`)
  and social charges (`645`) and crediting the bank (`512`) by their sum.
  Wages are owed whatever their size, so its power has no limit; the
  entry may hold nothing else. It stands in for the payslip feat, which
  will post each payslip.
- **adjust** posts a correcting entry, naming the entry it corrects
  (`base: 'corrected'`): the notary refuses a second correction of the
  same entry. Whether a correction also needs the circle's decision is a
  circle setting, not part of the write's label.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| post | `record-entry`, with no limit | Julien, as finance |
| pay | `pay-supplier`, within the mandate's limit for the amount paid | Julien, as finance, up to 3 000 € a payment |
| payroll | `run-payroll`, with no limit | Julien, as finance |
| adjust | `record-entry`, with no limit; it may credit a cash account only to undo what it corrects | Julien, as finance |

`003-powers.sql` registers post's power in `cella.power`, and
`004-pay.sql` pay's, with `amount` as the payload field the limit caps,
`005-payroll.sql` payroll's and `006-adjust.sql` adjust's; the
`circle-member` graft checks them.
Keeping the books is a duty, so a VAT return or an accrual posts under
`record-entry` whatever its size. Every member reads the books; reading
needs no power.

## Invariants

The transaction feat owns the rules about entries alone:

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
- the right to take money out of a share: `account.draw`'s, bounded on
  the share, which posts through `account-transaction`.

## What it does not know

Transaction knows no accounts beyond their codes, and no invoices,
members, allocations or periods. It does not know a period is closed; the
graft does. VAT returns and statutory exports such as the FEC read the
journal at rung 3.

## Schema

`transaction` (`core/sql/`):

- `transaction.entry`: id (`je-0041`, gapless), date, label,
  `corrects` and the receipt it was posted at; an entry carried over from
  before the log has no receipt.
- `transaction.line`: the entry, its line number, the account code, a
  side (`debit` or `credit`) and one positive `cella.amount`.

A deferred constraint trigger checks that every entry balances over two
lines or more; the db library makes it immediate before the verdict, so an
unbalanced entry is refused inside the write. Another trigger refuses any
update or delete: the journal is permanent. A third numbers each entry
(below). All raise SQLSTATE `09000`.
The app role may select and insert; the rules role, `cella_rules`, may
select.

## Rules

- `transaction.corrects`, on `transaction:transaction:adjust`: the entry
  corrects the entry the payload names, and that entry's latest correction
  before it is the payload's `base`; a second correction from the same base
  is refused.
- `transaction.pays`, on `transaction:transaction:pay`: the entry is two
  lines, `401` debited and `512` credited, each by the payload's `amount`,
  so the mandate's limit caps what left the bank.
- `transaction.payroll`, on `transaction:transaction:payroll`: the entry
  debits only `641` and `645` and credits `512` once, by their sum, since
  it balances.

## Handlers

- `record(tx, entry)`: writes an entry and its lines inside a write's
  transaction. Grafts that post, such as `invoice-transaction`, use it.
- `post` (confluent): records a balanced entry. At rung 1 it is still
  refused when it does not balance or is dated in a closed period, so it
  returns `Refused` beside `Settled`.
- `pay` (confluent): records a supplier payment, `401` against `512`, and
  commits its amount; refused beyond the payer's limit.
- `payroll` (confluent): records a month's wages and charges against
  `512`.
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
nothing else, `transaction.payroll` a payroll and nothing else, and
`transaction.corrects` refuses a second correction from the same base.

## Shell

The `journal`, the latest entry first, each with the sum of its debits;
an entry's page lists its lines and the entries that correct it. Posting
from the shell is not offered: the pilot's entries come from invoices,
through `invoice-transaction`.

## Lanterne

- Forty entries from 1 July to 24 October 2026, `je-0001` to `je-0040`.
- `je-0001` carries the opening balances over from the previous tool: the
  bank at 92 000 €, capital, reserves and the year's result against it.
- Each invoice posts an entry on issue (`411` against `706` and `44571`)
  and one per payment (`512` against `411`). `je-0026` is the credit note
  that voided F-2026-0050.
- Payroll is one entry a month (`641` and `645` against `512`), run by
  Julien through `payroll` until the payslip feat exists; October's is
  due on the 28th.
