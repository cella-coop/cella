+++
title = "patronage-timesheet"
updated = 2026-10-25
+++

How a surplus's work share divides among the workers by time worked,
from their approved months (Code du travail, art. L3324-5;
BOI-BIC-PTP-10-30, § 280). Declared by `patronage`.

## Schema

`patronage_timesheet` (`sql/`):

- `basis(year)`: the minutes each worker worked in a year, from the
  entries of their approved months only.
- `division(distribution)`: the portion of the work share the year's
  terms give time worked (`patronage.portion`), split by each worker's
  minutes with `cella.allocate`, so the parts add up to it to the cent.
- `parts_by_time`, a trigger after a distribution is approved, in that
  write, whichever makes it: it inserts the division into
  `patronage.part`.

## Rules

- `patronage_timesheet.divides`, on `patronage:distribution:approve`: the
  parts by time worked are exactly the division by the minutes approved
  that year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice patronage-timesheet`):
the portion divides by the minutes of approved months in the year alone;
approving makes the parts, which both rules take; parts no longer what
the approved time gives are refused.

## Shell

Adds to a distribution's page, until it is approved, how its portion by
time worked would divide, member by member.

## Lanterne

The statutes' terms divide by pay alone, and timesheets began in
September 2026, so no Lanterne surplus divides by time yet.
