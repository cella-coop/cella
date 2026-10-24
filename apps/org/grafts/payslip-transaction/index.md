+++
title = "payslip-transaction"
updated = 2026-10-24
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
the event; `lines(month, event)`.

## Rules

- `payslip_transaction.accrued`, on `payslip:run:approve`, and `.paid`, on
  `payslip:run:pay`: the run has a posting for the event, dated as above,
  whose lines are exactly the event's.

## Handlers

`approve` and `pay` wrap the payslip feat's specs: the run's state, then
the entry through the transaction feat's `record`, then the posting, then
`cella.submit` once.

## Shell

Replaces the payslip feat's approve and pay with these, and lists the
entries a payslip's run posted on its page.

## Lanterne

`je-0009`, `je-0019` and `je-0031` are July to September's runs, carried.
