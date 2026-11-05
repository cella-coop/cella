+++
title = "payslip-timesheet"
updated = 2026-11-07
+++

A pay run from approved time: each payslip holds the minutes of its
member's approved months, one for each circle they worked for that
month, and a run waits until every salaried member's month is approved
in every circle. Declared by `payslip`.

## Schema

`payslip_timesheet` (`sql/`): `minutes(member, month)`, the minutes a
member logged in a month, summed across circles.

## Guards

- `payslip_timesheet.timed`, on `payslip:run:generate`: every payslip's
  member had their month approved in every circle they worked for, and
  the payslip holds the minutes of all of them. A month still open or
  only submitted in any one circle holds the run back, naming it and its
  circle.

The approval a run waits for is ordered and fixes the month's entries, so
the time a run reads never changes after.

## Folds

A run's preparation folds by `payslip_timesheet.fold_generate`
(`sql/002-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)), once the
payslip feat's fold has prepared it: the minutes each payslip was
worked, as the commitments its entry keeps, since a folded scope's time
entries hold none of the minutes they commit to.

## Handlers

`generate` wraps the payslip feat's `generating`: the payslips, then each
one's minutes, which it reads from the member's months and the payslip
feat's `timing` sets, in one write.

## Tests

`ts/_tests/timed.test.ts` (`cella test slice payslip-timesheet`): a run
waits for every month, open or submitted, a member's month in a second
circle among them, and takes each payslip's minutes, summed over both
circles, once all are approved.

## Shell

Replaces the payslip feat's generate with this one.
