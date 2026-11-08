+++
title = "Bill"
updated = 2026-11-08
+++

What the co-op is billed: a supplier's bill recorded as it came, with its
lines, its VAT by rate and its due date; approved by someone with the
power to, within their mandate's limit; and paid from the bank. A bill
names its supplier as text; what it charges and pays in the books is the
`bill-transaction` graft's.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| bill | `id`, `supplier`, `reference`, `issued`, `due`, `label`, `category`, `lines[]`, `net`, `vat?`, `total`, `status`, `recorded`, `recorder`, `approved?`, `approver?`, `paid?` | `id` is `bi-0001` and up, its number four digits or more, so `bi-10000` follows `bi-9999`; `reference` is the supplier's own number for it; `category` the account of class 6 it is charged to |
| line | `description`, `quantity`, `unit_price`, `amount`, `vat_rate` | `amount` = quantity × unit price, as an invoice's line |

A bill's lines, their amounts and their VAT are counted as an invoice's
are, by the [VAT core library](../../core/vat/index.md): the two feats
share the arithmetic, never each other.

## Lifecycle

```mermaid
stateDiagram-v2
  direction LR
  recorded --> approved: approve
  approved --> paid: pay
```

Any other move is refused, whatever writes it, and a bill's figures and
lines never change once recorded: a bill recorded wrong is the
supplier's to correct with a credit note, which is not built. `overdue`
is not a state: it is read from `due` on a bill not yet paid.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/bill/record` | confluent | a bill is a fact from a supplier; the same one recorded twice merges |
| `POST /api/bill/approve` | ordered | decides the bill once, within the approver's limit |
| `POST /api/bill/pay` | ordered | money leaves the bank, once |

- **record** writes the bill and its lines, its amounts computed in SQL
  from the lines. The same supplier's reference recorded again merges
  into the bill already recorded and returns `merged`.
- **approve** approves a recorded bill on the verdict date, for its
  total, by someone other than who recorded it.
- **pay** pays an approved bill on the verdict date, for its total.

Approving charges the bill to the books, and paying pays it from the
bank, so the writes the shell serves are the `bill-transaction` graft's,
over this feat's `approving` and `paying` specs.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| record | `record-bill` | Julien, as finance |
| approve | `approve-bill`, within the mandate's limit for the bill's total | Camille, as manager, up to 5 000 € a bill |
| pay | `pay-supplier`, within the mandate's limit for the bill's total | Julien, as finance, up to 3 000 € |

`002-powers.sql` registers them in `cella.power`; the membership
feat checks the power and the limit.

## Invariants

- `total` = `net` + `vat`; `net` is the sum of the lines' amounts and
  `vat` the sum of their VAT, none where it is nothing;
- a bill moves only along its lifecycle, approved and paid once;
- its figures and lines never change once recorded;
- one bill per supplier and reference;
- it is approved by someone other than its recorder, for its whole total,
  and paid for its whole total.

What it does not own: what it charges and pays in the books
(`bill-transaction`), and the supplier as a record of its own, which
waits on a contact feat.

## Schema

`bill` (`core/sql/`):

- `bill.bill`, numbered from `bill.number`, which a refused write may
  leave a gap in, since a bill's number is the co-op's handle on it and
  not a legal series as an invoice's is: as recorded, the supplier,
  its reference, the date it bears (`issued`), `due` (thirty days after
  it when the supplier names none), the label, the category, `net`, `vat`
  and `total` as `cella.amount` (a NULL `vat` is a bill without VAT),
  unique by supplier and reference; `status`, `recorded` and `recorder`,
  then `approved` and `approver`, then `paid`.
- `bill.line`: description, quantity (exact decimal), unit price, amount
  (`cella.line_amount`) and VAT rate, a percent with two decimals.
- `bill.taxed`: each bill's VAT by rate, the net of its lines at the rate
  and the tax on it in cents (`cella.line_vat`), adding up to the bill's
  `vat`. It reads as its reader, so it shows only the records its reader reads.

Triggers raise SQLSTATE `09000`: a deferred one checks that the lines add
up to the net and the VAT; `bill.moves` keeps the lifecycle, a bill's
figures and its lines. The app role may select, insert and update; the
guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`bill.bill.circle` is the circle whose purchase the bill is, which its
record names; its lines are in its circle, which `bill.in_its_circle`
copies into each as it is made, and a line made in the statement that
makes its bill names it itself.

## Guards

- `bill.records`, on `bill:bill:record`: the bill was recorded on the
  verdict date by the actor, unless it merged into one recorded before.
- `bill.approves`, on `bill:bill:approve`: approved by this write on the
  verdict date, by the actor and not by its recorder, for the total the
  payload names, which the mandate's limit caps.
- `bill.pays`, on `bill:bill:pay`: paid by this write on the verdict
  date, for the total the payload names.

That approving and paying post their entries is the `bill-transaction`
graft's guard on the same ops.

## Folds

Each action folds by `core/sql/005-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)): a record
makes the bill under the id its entry names, in its circle, recorded on
the entry's day by its actor, with its supplier, reference, days, label,
category, amounts and lines as the entry keeps them, each quantity and
VAT rate as their text, and one that merged adds nothing; an approval
approves it on its entry's day by its actor, and a payment pays it on
its entry's day. What approving and paying post folds by
`bill-transaction`'s folds.

## Handlers

`record`, and the specs `approving` and `paying` that the graft wraps
with their postings, each also a write of its own (`approve`, `pay`).
Each line's VAT rate comes in hundredths of a percent, as an invoice's
does. The payload holds the bill's id, its circle and its amounts, and
for a record that did not merge what its fold records again: the
supplier, its reference, the days the bill bears, its label, category
and lines. The supplier's name and the label enter the log as they are:
a supplier may be a person, a sole trader, but nothing of a bill says
whose, so neither is registered personal, and the entries a bill posts
name only its id (`Bill bi-0007`), so the log held neither before.

## Tests

`core/ts/_tests/bill.test.ts` (`cella test slice bill`): a bill is
numbered and adds up line by line with its VAT by rate, merges by its
supplier's reference, moves only along its lifecycle, keeps its figures
and lines, and the guards refuse a write that did not do what it says,
an approval by its recorder among them.

## Shell

The `bills` collection in Payments, the latest recorded first, each with
its status, overdue where it is; its dashboard shows what awaits approval
and payment, what is overdue, and the amounts by month and by category.
New records one (`record`) with its lines, typed as an invoice's are. A
bill's page shows its lines and its VAT by rate, and its next write:
approve when recorded, pay when approved.

## Lanterne

Two October bills, recorded by Julien and not yet approved: Imprimerie
du Parc's paper stock, 1 200 € and 240 € of VAT, and Atelier Lumen's
rent for October, 900 € and 180 €.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `bill.bills` and `bill.taxes` to the analytics shell: each supplier's bill with its figures and lifecycle, and its VAT by rate. Both are scoped by `circle`, the circle that owns the bill.
