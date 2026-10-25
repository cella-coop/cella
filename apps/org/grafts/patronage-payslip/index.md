+++
title = "patronage-payslip"
updated = 2026-10-25
+++

How a surplus's work share divides among the workers by pay and in equal
parts, the two bases the payslip feat knows (Code du travail, art.
L3324-5, allows pay, time worked, equal parts or a mix; loi n° 78-763,
art. 33, 3°, gives the share to every employee). Declared by `patronage`.

## Schema

`patronage_payslip` (`sql/`):

- `basis(year)`: what each worker was paid in a year, gross, from the
  salary in force on the first of each month.
- `division(distribution)`: the portions of the work share the year's
  terms give pay and equal parts (`patronage.portion`), each split among
  those paid that year by `cella.allocate`, by what each was paid or one
  part each, so the parts add up to the portion to the cent.
- `parts_by_pay`, a trigger after a distribution is approved, in that
  write, whichever makes it: it inserts the division into
  `patronage.part`.
- `work_share`: each worker's part by pay as it divides now, which the
  distribution's page shows until it is approved.

## Rules

- `patronage_payslip.divides`, on `patronage:distribution:approve`: the
  parts by pay and in equal parts are exactly the division among those
  paid that year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice patronage-payslip`): a
mix of pay and equal parts divides among those paid in the year, half a
year's pay counting half; approving makes the parts, which both rules
take; parts no longer what the year's pay gives are refused.

## Shell

Adds to a distribution's page, until it is approved, how its portion by
pay would divide, member by member.

## Lanterne

The 2025 work share, 27 630 €, divides among the ten members by their
2025 salaries, as the statutes' terms say.
