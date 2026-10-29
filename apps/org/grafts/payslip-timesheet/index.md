+++
title = "payslip-timesheet"
updated = 2026-10-29
+++

A pay run from approved time: each payslip holds the minutes of its
member's approved month, and a run waits until every salaried member's
month is approved. Declared by `payslip`.

## Schema

`payslip_timesheet` (`sql/`): `minutes(member, month)`, the minutes a
member logged in a month.

## Rules

- `payslip_timesheet.timed`, on `payslip:run:generate`: every payslip's
  member had their month approved, and the payslip holds its minutes. A
  month still open or only submitted holds the run back, naming it.

The approval a run waits for is ordered and fixes the month's entries, so
the time a run reads never changes after.

## Handlers

`generate` wraps the payslip feat's `generating`: the payslips, then each
one's minutes, which it reads from the member's month and the payslip
feat's `timing` sets, in one write.

## Tests

`ts/_tests/timed.test.ts` (`cella test slice payslip-timesheet`): a run
waits for every month, open or submitted, and takes each payslip's
minutes once approved.

## Shell

Replaces the payslip feat's generate with this one.
