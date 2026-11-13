+++
title = "payslip-transaction"
updated = 2026-11-13
+++

A pay run's approval and its payment post balanced entries, in the same
database transaction as the run write and under the same verdict.
Declared by `payslip`.

## Postings

For a French SCOP's chart:

| Event | Debit | Credit |
|---|---|---|
| approval (accrual), dated the run's last day | `641` gross pay; `645` the employer's contributions | `421` net pay; `431` both parties' contributions |
| payment, dated the day it is paid | `421`; `431` | `512` the bank, their sum |

A run carried over from before the books moved here posted its pay and
its payment in one entry, `641` and `645` against `512`; its posting's
event is `carried`.

## Schema

`payslip_transaction` (`sql/`): `posting`, the entry, the run's month and
the event; `lines(month, event)`; `payment_lines`, the register of what
the grafts above add to a run's payment, filled by
`register_payment_lines(lines, keeps, owner)`, this graft's published
register, and read by `added(month)` and `keep(month, entry)`.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `payslip_transaction.accrued`, on `payslip:run:approve`, and `.paid`, on
  `payslip:run:pay`: the run has a posting for the event, dated as above,
  whose entry posts every line of the event. A write posts one entry, so
  what a graft above posts in the same write, such as an instalment of
  capital withheld from an associate's pay
  (`account-membership-payslip-transaction`), is lines of that entry: they
  balance among themselves and credit neither the bank nor an account the
  event's own lines post to, and the graft that adds them checks they are
  exactly its own.

## Folds

A run's approval and its payment fold by `sql/003-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)), once the payslip feat's fold has
moved the run: the entry each posted, as its payload keeps it, linked as
the event it is. What a graft above kept of a payment's lines its own
fold of the payment rebuilds, from the personal figures the payload
keeps as `kept`.

## Handlers

`approve` and `pay` wrap the payslip feat's specs: the run's state, then
the entry through the transaction feat's `record`, then the posting, then
`cella.submit` once. `pay`'s entry carries, beside the event's own lines,
those `added(month)` answers: the lines of each function a graft above
registered, a function of the run's month answering lines, in the order
of their owners and names, each naming whose own figure it is where it
is a person's, so the entry keeps its amount as its commitment. Once the
entry is posted, `pay` calls `keep(month, entry)`, which runs each
registrant's `keeps`, a function of the month and the entry, by which
the graft records in its own schema what it keeps of its lines and
answers each personal figure it kept, by its personal column and its
subject; the payment's payload keeps them as `kept`, each figure as its
commitment, so no entry shows an associate's instalment in plain.
Each is called by the schema and name its function has, its arguments
cast to the types it was registered with, so a function overloaded
under its name runs the overload registered. This graft knows none of
them by name, and no graft above puts a trigger on `posting`.

## Shell

Replaces the payslip feat's approve and pay with these, and lists the
entries a payslip's run posted on its page.

## Lanterne

`je-0009`, `je-0019` and `je-0031` are July to September's runs, carried. The
bank holds 39 190,40 € on 24 October, after them and after `je-0042`,
the 105,60 € reimbursement of `ex-0005` on 15 October.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `payslip_transaction.postings` to the analytics shell: which entry posted which month's payroll, and on what event. It is scoped by `circle`, the circle that owns each row. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
