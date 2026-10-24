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
| `POST /api/transaction/credit` | confluent | deposits merge |
| `POST /api/transaction/debit` | bounded | from a share; beyond it, ordered |
| `POST /api/transaction/adjust` | ordered | a correction, which needs a decision |

- **credit** posts an entry that brings money in. Sums commute, so two
  deposits merge in any order and never wait.
- **debit** posts an entry that takes money out. It spends a share granted
  in advance from a mandate's limit, so it settles at once within the
  share, and at rung 2 offline; beyond it, it needs a fresh grant.
- **adjust** posts a correcting entry. It is ordered and waits on a
  majority decision, so that no one quietly rewrites the books.

How credit and debit map onto balanced entries, which always do both, is
open; see [conflicts](../../../../_corpus/doc/conflicts.md).

## Powers

| Write | Power | Lanterne |
|---|---|---|
| credit | `record-receipt` | Julien, as finance |
| debit | `pay-supplier`, up to the mandate's `max_amount` | Julien, 3 000 € a payment |
| adjust | held by the circle that keeps the books, by decision | `ag`, majority |

Every member reads the books; reading needs no power.

## Invariants

The transaction feat owns the rules about entries alone:

- every entry balances: its debits equal its credits;
- every amount is positive, in cents (`cella.amount`); a line is a debit
  or a credit, never both, never zero;
- an entry, once posted, never changes;
- an entry corrects only an entry of this journal.

What it does not own:

- that a line's account exists and its period is open: the
  `account-transaction` graft's;
- that an invoice's issue, payments and void post the right entries: the
  `invoice-transaction` graft's;
- whether a debit's spender holds the power: the mandate, read through
  `cella.may`.

## What it does not know

Transaction knows no accounts beyond their codes, and no invoices,
members, allocations or periods. It does not know a period is closed; the
graft does. VAT returns and statutory exports such as the FEC read the
journal at rung 3.

## Lanterne

- Forty entries from 1 July to 24 October 2026, `je-0001` to `je-0040`.
- `je-0001` carries the opening balances over from the previous tool: the
  bank at 92 000 €, capital, reserves and the year's result against it.
- Each invoice posts an entry on issue (`411` against `706` and `44571`)
  and one per payment (`512` against `411`). `je-0026` is the credit note
  that voided F-2026-0050.
- Payroll is one entry a month (`641` and `645` against `512`) until the
  payslip feat exists.
