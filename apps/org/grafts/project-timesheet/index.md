+++
title = "project-timesheet"
updated = 2026-10-25
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

The app role may select and insert bookings; the rules role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `timesheet:entry:log`, on a project's page | confluent | `log-time` | the timesheet feat's log and the booking, in one transaction under its verdict |

The feat's rules judge the entry, the graft's trigger the booking. An
entry is booked when it is logged; moving it to another project is not
built. `booking` (`./api`) books the entry any write logs, under that
write's op: this graft's `book` over the feat's log, and
`employment-project-timesheet`'s over a worker's log by their employment,
which needs no mandate.

## Invariants

- a booking's entry exists, and its project exists and is not archived.

## Reads

`costed` reads as its reader, each booked entry as its time does; `burn`, a project's time at the co-op's rates, sums the whole for every member (`sql/003-reads.sql`).

## Shell

Adds to each entry its project's title, and to the timesheets' dashboard
the hours by project; to each project its hours and what they spent, a
card field of the projects' gallery. On a project's page it adds the Time
tab: the hours, billable hours and what they spent, the hours by member,
the latest entries and logging time against the project as the acting
member.

## Lanterne

The rate is 80 € an hour, the 560 € day rate over a seven-hour day. An
hour costs the co-op 23,64 €: September's pay run, 36 400 € with the
employer's contributions, over the 1 540 hours logged in it. Since
September the Halles shop's time has spent about 16 000 € of its 48 000 €,
Ferrand's 13 760 € of its 14 000 €.
