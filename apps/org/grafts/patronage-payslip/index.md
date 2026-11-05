+++
title = "patronage-payslip"
updated = 2026-11-05
+++

How a surplus's work share divides among the workers by pay and in equal
parts, the two bases the payslip feat knows (Code du travail, art.
L3324-5, allows pay, time worked, equal parts or a mix; loi n° 78-763,
art. 33, 3°, gives the share to every employee). Declared by `patronage`.

## Schema

`patronage_payslip` (`sql/`):

- `basis(year)`: what each worker was paid in a year, gross, from the
  salary in force on the first of each month, so a worker who left
  counts the months before they left and none after, that year or any
  later. Presence at the year's end is no condition: the law gives the
  work share to every employee, and a condition the statutes add is
  `patronage`'s, not built.
- `division(distribution)`: the portions of the work share the year's
  terms give pay and equal parts (`patronage.portion`), each split by
  `cella.allocate` so the parts add up to the portion to the cent. The
  part by pay goes among those paid more than nothing that year, by what
  each was paid. The equal part goes one each to every worker with a
  salary in force on some day of the year, whatever it pays and whether
  or not it was in force on a month's first day, so one hired on 15
  December, or paid from 2 to 30 March, has an equal part and none by
  pay. No salary is 0 €: an amount is positive.
- its division, registered by its migration for the bases `salary` and
  `equal` through the patronage feat's `patronage.register_division`,
  which the feat's approve asks and whose answer it inserts into
  `patronage.part` itself; the graft writes no part and puts no trigger
  on `patronage.distribution`.
- `work_share`: each worker's part by pay as it divides now, which the
  distribution's page shows until it is approved.

## Guards

- `patronage_payslip.divides`, on `patronage:distribution:approve`: the
  parts by pay and in equal parts are exactly the division among those
  with a salary that year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice patronage-payslip`): a
mix of pay and equal parts divides among those paid in the year, half a
year's pay counting half; a worker who left on 30 November counts eleven
months, and one who left the year before none, by pay or in equal parts;
a worker paid from 2 to 30 March and one hired on 15 December each have
an equal part and none by pay; approving makes the parts, which both
guards take; parts no longer what the year's pay gives are refused.

## Reads

`work_share` shows each worker's share to the worker and to whoever holds `distribute-surplus`; `division` runs as its owner over every salary, so each share it shows is the one the approval makes, whoever reads it, and keeps of them only the parts its reader reads, by the personal row's test, so called alone it shows no more than `work_share`; it is declared `audience: shared` (`sql/002-reads.sql`, [reading](../../../../_corpus/doc/architecture.md#reading)). `work_share` reads as its owner and filters its rows by the same test, declared `audience: shared`, which `cella check feats` holds it to.

## Shell

Adds to a distribution's page, until it is approved, how its portion by
pay would divide, member by member.

## Lanterne

The 2025 work share, 27 630 €, divides among the ten members by their
2025 salaries, as the statutes' terms say.
