+++
title = "Expense"
updated = 2026-11-08
+++

What the co-op's workers spend for it from their own pocket, to be paid back:
claimed, submitted, approved or refused by someone with the power to,
within their mandate's limit and their budget for the month, and
reimbursed from the bank.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| expense | `id`, `member`, `day`, `label`, `category`, `net`, `vat?`, `receipt?`, `status`, `submitted?`, `decided?`, `decider?`, `reimbursed?` | `id` is `ex-0001` and up, its number four digits or more, so `ex-10000` follows `ex-9999`; amounts in cents; `category` is the account of class 6 it is charged to; `receipt` a reference the member typed, beside the receipts kept as files |

An expense names its claimant, `member`, and its decider by address, as
text; their names are the `expense-membership` graft's. Its label and
receipt are the claimant's own words and stay out of the log. Its total is
`expense.total`, the amount before VAT and the deductible VAT.

## Lifecycle

draft → submitted → approved → reimbursed, or submitted → refused. Any
other move is refused, whatever writes it, and a submitted expense's
figures never change.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/expense/capture` | confluent, `claim-expense` | a claim is a fact, the claimant's own; every employee's right |
| `POST /api/expense/submit` | confluent, `claim-expense` | the claimant's own, once; every employee's right |
| `POST /api/expense/approve` | bounded on the approver's budget | spends a budget granted in advance by the approver's mandate |
| `POST /api/expense/refuse` | ordered | decides the expense against an approval: only one stands |
| `POST /api/expense/reimburse` | ordered | money leaves the bank, once |

Approving charges the expense to the books, and reimbursing pays it, so
the writes that serve them are the `expense-transaction` graft's, over
this feat's `approving` and `reimbursing` specs.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| capture, submit | `claim-expense`, every employee's right: the claimant's own | every worker, member or not |
| approve | `approve-expense`, within the mandate's limit for the expense's total, and its budget for the month | each lead, 1 000 € a month; Camille, as gérante, up to 2 000 € an expense |
| refuse | `approve-expense` | as approve |
| reimburse | `reimburse-expense`, within the mandate's limit | Julien, as finance, up to 3 000 € |

`002-powers.sql` registers them in `cella.power`; the membership
feat checks the power and the limit, a right's for a claim
([rights](../circle/index.md#rights)), and the `expense-membership`
graft the budget.

## Invariants

- an expense moves only along its lifecycle, and is decided and
  reimbursed once;
- its figures never change once submitted;
- it is decided by someone other than its member, for its whole amount;
- it is the actor's own when claimed and submitted.

What it does not own: whose it is (`expense-membership`), what it charges and
pays in the books (`expense-transaction`), the project it is billed on to
(`expense-project`), its receipts, kept as files (`expense-file`), and the
approver's budget, which needs their seats and mandates
(`expense-membership`).

## Schema

`expense` (`core/sql/`): `expense.expense`, numbered from
`expense.number`; `expense.moves`, the lifecycle trigger, raising SQLSTATE
`09000`; `expense.total(expense)`. The app role may select, insert and
update; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`expense.expense.circle` is the circle the expense was spent for, which
its capture names.

## Personal data

What the member wrote of an expense and the text of its receipt are
personal data of class `expense-receipt`, registered by the member
(`003-personal.sql`): supporting vouchers, which the law keeps ten
years (Code de commerce, art. L123-22). A capture's payload commits to
them; erasing a member who has left restricts them until `cella vault
sweep` redacts them, the one change a submitted expense takes
(`cella.redacting()` in `expense.moves`). Its figures are the books'.

## Guards

- `expense.captures`, on `expense:expense:capture`: the expense is the
  actor's own, spent on a day that has come.
- `expense.submits`, on `expense:expense:submit`: the actor's own,
  submitted by this write.
- `expense.decides`, on `expense:expense:approve` and `:refuse`: decided by
  this write on the verdict date, by someone other than its member, for
  the total the payload names, which the mandate's limit caps.
- `expense.reimburses`, on `expense:expense:reimburse`: reimbursed by this
  write, for its total.

## Folds

Each action folds by `core/sql/005-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)): a claim under
the id and in the circle its entry names, its figures before VAT and
its VAT as the entry keeps them, which must make the total it names,
and its label and receipt as their commitments; a submission, a
refusal, an approval and a reimbursement on their entries' days, a
decision by the entry's actor. expense-transaction folds the entries an
approval and a reimbursement post, expense-file a receipt a claim
carries, expense-project the project an expense is filed under.

## Reads

An expense reads by core's row-level policy, by its owning circle
([reading](../../core/circle/index.md#reading)): whoever holds `read`
over its circle, and whoever holds `approve-expense` or
`reimburse-expense` over it (`sql/004-reads.sql`), since what a mandate
acts on its holder reads. At Lanterne Inès, in Web and no member, reads
Web's and the assembly's expenses and not Marketing's; every member,
by open books, and the gérante and finance, whose mandates cover the
whole co-op, read every one.

## Handlers

`capture`, `submit` and `refuse`, and the specs `approving` and
`reimbursing` the graft wraps with their postings.

## Tests

`core/ts/_tests/expense.test.ts` (`cella test slice expense`): an expense
is numbered and totalled, moves only along its lifecycle, keeps its
figures once submitted, and the guards refuse a write that did not do what
it says. `core/ts/_tests/folds.test.ts`: a claim folds under its id, its
label and receipt as their commitments, refusing figures that do not
make its total, and moves along its lifecycle on its entries' days.

## Shell

The `expenses` collection in Payments, a board by status on which dragging
a card into the next column is that column's write (submit, approve,
refuse, reimburse), with a dashboard of what awaits approval and
reimbursement and the spend by category and month; a new claim as the
acting member, which `expense-file` replaces with one carrying its
receipt; and an expense's page with its next write and its receipts.

## Lanterne

Four October expenses: Sofia's print proofs, 180 €, Chloé's workshop
coffee and Léa's font licence, submitted; Thomas's train to Clairval, a
draft.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `expense.expenses` to the analytics shell: each expense, whose it is, its category, figures and lifecycle. Its label and receipt are personal and are not shared. It is scoped by `circle`, the circle that owns the expense, and by `member`, whose claim it is.
