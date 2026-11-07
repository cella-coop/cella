+++
title = "patronage-timesheet"
updated = 2026-11-09
+++

How a surplus's work share divides among the workers by time worked,
from their approved months (Code du travail, art. L3324-5;
BOI-BIC-PTP-10-30, § 280). Declared by `patronage`.

## Schema

`patronage_timesheet` (`sql/`):

- `basis(year)`: the minutes each worker worked in a year, from the
  entries of their approved months only: a month is a circle's, so time
  worked for two circles counts each circle's once its month there is
  approved, and the two sum.
- `division(distribution)`: the portion of the work share the year's
  terms give time worked (`patronage.portion`), split by each worker's
  minutes with `cella.allocate`, so the parts add up to it to the cent.
- its division, registered by its migration for the basis `hours`
  through the patronage feat's `patronage.register_division`, which the
  feat's approve asks and whose answer it inserts into `patronage.part`
  itself; the graft writes no part and puts no trigger on
  `patronage.distribution`.
- `time_share`, a view: each worker's share by time worked of each
  distribution, as the division gives it.

## Guards

- `patronage_timesheet.divides`, on `patronage:distribution:approve`: the
  parts by time worked are exactly the division by the minutes approved
  that year.

## Tests

`ts/_tests/division.test.ts` (`cella test slice patronage-timesheet`):
the portion divides by the minutes of approved months in the year alone;
approving makes the parts, which both guards take; parts no longer what
the approved time gives are refused; a member's month in a second circle
counts once it is approved.

## Reads

`division` runs as its owner over everyone's approved time, so each share it gives is the one the approval makes, whoever reads it, and keeps of them only the parts its reader reads, by the personal row's test, so called alone it shows no more than `time_share`, and is declared `audience: shared` ([reading](../../../../_corpus/doc/architecture.md#reading)); `time_share` shows each worker's to the worker and to whoever holds `distribute-surplus` (`sql/002-reads.sql`). `time_share` reads as its owner and filters its rows by the same test, declared `audience: shared`, which `cella check feats` holds it to.

## Shell

Adds to a distribution's Split tab, until it is approved, how its portion
by time worked would divide, member by member, each as its reader may read it.

## Lanterne

The statutes' terms divide by pay alone, and timesheets began in
September 2026, so no Lanterne surplus divides by time yet.
