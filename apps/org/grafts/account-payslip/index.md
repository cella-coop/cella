+++
title = "account-payslip"
updated = 2026-10-25
+++

How a surplus's work share divides among the workers by pay and in equal
parts, the two bases the payslip feat knows (Code du travail, art.
L3324-5, allows pay, time worked, equal parts or a mix; loi n° 78-763,
art. 33, 3°, gives the share to every employee). Declared by `account`.

## Schema

`account_payslip` (`sql/`):

- `basis(year)`: what each worker was paid in a year, gross, from the
  salary in force on the first of each month.
- `division(allocation)`: the portions of the work share the year's terms
  give pay and equal parts (`account.portion`), each split among those
  paid that year by `cella.allocate`, by what each was paid or one part
  each, so the parts add up to the portion to the cent.
- `parts_by_pay`, a trigger after an allocation is allocated, in that
  write, whichever makes it: it inserts the division into `account.part`.
- `work_share`: each worker's part by pay as it divides now, which the
  allocation's page shows until it is allocated.

## Rules

- `account_payslip.divides`, on `account:surplus:allocate`: the parts by
  pay and in equal parts are exactly the division among those paid that
  year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice account-payslip`): a mix
of pay and equal parts divides among those paid in the year, half a
year's pay counting half; allocating makes the parts, which both rules
take; parts no longer what the year's pay gives are refused.

## Shell

Adds to an allocation's page, until it is allocated, how its portion by
pay would divide, member by member.

## Lanterne

The 2025 work share, 27 630 €, divides among the ten members by their
2025 salaries, as the statutes' terms say.
