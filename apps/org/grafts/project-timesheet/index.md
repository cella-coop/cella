+++
title = "project-timesheet"
updated = 2026-11-16
+++

Time against a project, what it spent of the budget, what it cost the
co-op, and where the budget lands at the pace so far. An entry booked
to no project is the co-op's own time, not invalid. Declared by
`timesheet`.

## Schema

`project_timesheet` (`sql/`):

- `project_timesheet.booking`: an entry and its project, with no foreign
  key into either feat. A trigger refuses an entry or a project that does
  not exist, or a project that is archived (SQLSTATE `09000`).
- `project_timesheet.rate`: the hourly rate billable time spends a budget
  at, from a day on, in cents. It is a parameter, seeded with the co-op's
  rate card; a write to it, and a rate per project or per client, are not
  built.
- `project_timesheet.cost`: what an hour of the co-op's time costs it,
  from a day on, in cents: pay and the employer's contributions over the
  hours worked. A parameter as the rate is; a cost per member, or one
  read from the pay runs, is not built.
- `project_timesheet.costed`: each booked entry with the rate and the
  cost in force on its day; `project_timesheet.burn`: each project's
  hours, billable hours, what they spent, billable hours at the rate, and
  what they cost, every hour at the cost.
- `project_timesheet.forecast(day)`: each project's budget burn on a
  day, what its billable time spent and the percent of its budget that
  is, how far through its span it is (`elapsed(…)`: 0 on the day it
  starts, 1 on its due day, once archived or once every milestone is
  complete, unknown without a due day), and what it will have spent at
  completion at the pace so far. The day is the caller's, since SQL
  reads no clock.

The app role may select and insert bookings; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `timesheet:entry:log`, on a project's page | confluent | `log-time` | the timesheet feat's log and the booking, in one transaction under its verdict |

The feat's guards judge the entry, the graft's trigger the booking. An
entry is booked when it is logged; moving it to another project is not
built. `booking` (`./api`) books the entry a write logs, under that
write's op: this graft's `book` over the feat's log, which needs
`log-time`, every employee's right, member or not; the week
`employment-project-timesheet` builds books each project's cell through
it.

## Invariants

- a booking's entry exists, and its project exists and is not archived.

## Folds

A booking folds by `project_timesheet.fold_log` (`sql/004-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)), on `timesheet:entry:log`, once
the timesheet feat's fold has logged the entry: the entry booked to the
project its entry names, where it names one, the graft's trigger judging
the project again, as it did. An entry that names none is the co-op's
own time. The rate and the cost are parameters no action writes, which
the founding carries.

## Reads

`costed` reads as its reader, each booked entry as its time does; `burn`, a project's time at the co-op's rates, sums the whole for every member, declared `audience: shared by project`, and so reads the tables and never `costed`, whose rows a view over it reads as their reader too (`sql/002-cost.sql`, `sql/003-reads.sql`).

## Shell

Adds to each entry its project's title, and to the timesheets' dashboard
the hours by project; to each project its hours and what they spent, a
card field of the projects' gallery, and its project's id, a hidden field by
which a project's page jumps in Related to its time. On a project's Budget
tab it adds: the hours, billable hours and what they spent, the hours by member,
the latest entries and logging time against the project as the acting
member, for the circle they name among those they sit in that day, the
project's offered first where they sit in it, so the entry goes into
their month of that circle.

## Lanterne

The rate is 80 € an hour, the 560 € day rate over a seven-hour day. An
hour costs the co-op 23,64 €: September's pay run, 36 400 € with the
employer's contributions, over the 1 540 hours logged in it. Since
September the Halles shop's time has spent about 16 000 € of its 48 000 €,
Ferrand's 13 760 € of its 14 000 €.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `project_timesheet.months`, `project_timesheet.rates` and `project_timesheet.costs` to the analytics shell: each project's time by month in minutes, summed over every member, with what its billable time spent at the billing rate and what all of it cost at the cost rate, in exact cents, which a report rounds once over the months it sums; and both rates by the day they apply from. An entry is its member's, so no row is one member's time. `project_timesheet.forecasts` is each project's burn on the scope's day, as `forecast` reads it: what its billable time spent and all its time cost, the share of its budget spent, how far through its span it is and its spend at completion, with the day. `project_timesheet.rates` and `project_timesheet.costs` are scoped by `circle`, the circle that owns each rate; `project_timesheet.months` is shared by `project` and `month`, and `project_timesheet.forecasts` by `project`. `project_timesheet.months` and `project_timesheet.forecasts` are counted: `project_timesheet.months_contributions` and `project_timesheet.forecasts_contributions` hold each person's minutes on each project, by month and over its life, read by timesheet's powers, which only the port reads, to withhold a cell from a reader where open books does not share it ([what is withheld](../../core/analytics/index.md#what-is-withheld)). Each of its views but the contributions is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
