+++
title = "account-timesheet"
updated = 2026-10-25
+++

How a surplus's work share divides among the members by time worked,
from their approved months (Code du travail, art. L3324-5;
BOI-BIC-PTP-10-30, § 280). Declared by `account`.

## Schema

`account_timesheet` (`sql/`):

- `basis(year)`: the minutes each member worked in a year, from the
  entries of their approved months only.
- `division(allocation)`: the portion of the work share the year's terms
  give time worked (`account.portion`), split by each member's minutes
  with `cella.allocate`, so the parts add up to it to the cent.
- `parts_by_time`, a trigger after an allocation is allocated, in that
  write, whichever makes it: it inserts the division into `account.part`.

## Rules

- `account_timesheet.divides`, on `account:surplus:allocate`: the parts
  by time worked are exactly the division by the minutes approved that
  year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice account-timesheet`): the
portion divides by the minutes of approved months in the year alone;
allocating makes the parts, which both rules take; parts no longer what
the approved time gives are refused.

## Shell

Adds to an allocation's page, until it is allocated, how its portion by
time worked would divide, member by member.

## Lanterne

The statutes' terms divide by pay alone, and timesheets began in
September 2026, so no Lanterne surplus divides by time yet.
