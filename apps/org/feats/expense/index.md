+++
title = "Expense"
updated = 2026-10-24
+++

What members spend for the co-op from their own pocket, to be paid back:
claimed, submitted, approved or refused by someone with the power to,
within their mandate's limit and their budget for the month, and
reimbursed from the bank.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| expense | `id`, `member`, `day`, `label`, `category`, `net`, `vat?`, `receipt?`, `status`, `submitted?`, `decided?`, `decider?`, `reimbursed?` | `id` is `ex-0001` and up; amounts in cents; `category` is the account of class 6 it is charged to; `receipt` a reference until files are stored |

An expense names its member and its decider by address, as text; that the
member is an active one is the `expense-member` graft's. Its label and
receipt are the member's own words and stay out of the log. Its total is
`expense.total`, the amount before VAT and the deductible VAT.

## Lifecycle

draft → submitted → approved → reimbursed, or submitted → refused. Any
other move is refused, whatever writes it, and a submitted expense's
figures never change.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/expense/capture` | confluent, `self` | a claim is a fact, the member's own |
| `POST /api/expense/submit` | confluent, `self` | the member's own, once |
| `POST /api/expense/approve` | bounded on the approver's budget | spends a budget granted in advance by the approver's mandate |
| `POST /api/expense/refuse` | ordered | decides the expense against an approval: only one stands |
| `POST /api/expense/reimburse` | ordered | money leaves the bank, once |

Approving charges the expense to the books, and reimbursing pays it, so
the writes that serve them are the `expense-transaction` graft's, over
this feat's `approving` and `reimbursing` specs.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| capture, submit | none: the member's own | every member |
| approve | `approve-expense`, within the mandate's limit for the expense's total, and its budget for the month | each lead, 1 000 € a month; Camille, as gérante, up to 2 000 € an expense |
| refuse | `approve-expense` | as approve |
| reimburse | `reimburse-expense`, within the mandate's limit | Julien, as finance, up to 3 000 € |

`002-powers.sql` registers them in `cella.power`; the `circle-member`
graft checks the power and the limit, and the `circle-expense-member`
graft the budget.

## Invariants

- an expense moves only along its lifecycle, and is decided and
  reimbursed once;
- its figures never change once submitted;
- it is decided by someone other than its member, for its whole amount;
- it is the actor's own when claimed and submitted.

What it does not own: whose it is (`expense-member`), what it charges and
pays in the books (`expense-transaction`), the project it is billed on to
(`expense-project`), and the approver's budget, which needs their seats
and mandates (`circle-expense-member`).

## Schema

`expense` (`core/sql/`): `expense.expense`, numbered from
`expense.number`; `expense.moves`, the lifecycle trigger, raising SQLSTATE
`09000`; `expense.total(expense)`. The app role may select, insert and
update; the rules role may select.

## Rules

- `expense.captures`, on `expense:expense:capture`: the expense is the
  actor's own, spent on a day that has come.
- `expense.submits`, on `expense:expense:submit`: the actor's own,
  submitted by this write.
- `expense.decides`, on `expense:expense:approve` and `:refuse`: decided by
  this write on the verdict date, by someone other than its member, for
  the total the payload names, which the mandate's limit caps.
- `expense.reimburses`, on `expense:expense:reimburse`: reimbursed by this
  write, for its total.

## Handlers

`capture`, `submit` and `refuse`, and the specs `approving` and
`reimbursing` the graft wraps with their postings.

## Tests

`core/ts/_tests/expense.test.ts` (`cella test slice expense`): an expense
is numbered and totalled, moves only along its lifecycle, keeps its
figures once submitted, and the rules refuse a write that did not do what
it says.

## Shell

The `expenses` collection in Finance, a board by status on which dragging
a card into the next column is that column's write (submit, approve,
refuse, reimburse), with a dashboard of what awaits approval and
reimbursement and the spend by category and month; a new claim as the
acting member; and an expense's page with its next write.

## Lanterne

Four October expenses: Sofia's print proofs, 180 €, Chloé's workshop
coffee and Léa's font licence, submitted; Thomas's train to Clairval, a
draft.
