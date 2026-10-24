+++
title = "account-payslip"
updated = 2026-10-24
+++

How a surplus's work share divides among the members when the statutes
divide it by salary (loi n° 78-763, art. 33, 3°, allows salary, time
worked or equal parts). Declared by `account`.

## Schema

`account_payslip` (`sql/`):

- `basis(year)`: what each member was paid in a year, gross, from the
  salary in force on the first of each month.
- `work_share`: each member's part of an allocation's work share whose
  basis is `salary`, split in proportion to their pay that year by
  `cella.allocate`, so the parts add up to the share to the cent.

A split by hours would read approved time, an `account-timesheet` graft
not built.

## Shell

Adds the work share, member by member, to an allocation's page.

## Lanterne

The 2025 work share, 27 630 €, divides among the ten members by their
2025 salaries.
