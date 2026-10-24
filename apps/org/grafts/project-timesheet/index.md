+++
title = "project-timesheet"
updated = 2026-10-24
+++

Time against a project, and what it spent of the budget. An entry booked
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
- `project_timesheet.costed`: each booked entry with the rate in force on
  its day; `project_timesheet.burn`: each project's hours, billable hours
  and what they spent, billable hours at the rate.

The app role may select and insert bookings; the rules role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `timesheet:entry:log`, on a project's page | confluent | `log-time` | the timesheet feat's log and the booking, in one transaction under its verdict |

The feat's rules judge the entry, the graft's trigger the booking. An
entry is booked when it is logged; moving it to another project is not
built.

## Invariants

- a booking's entry exists, and its project exists and is not archived.

## Shell

Adds to each entry its project's title, and to the timesheets' dashboard
the hours by project; to each project its hours and what they spent, a
card field of the projects' gallery. On a project's page it adds the Time
tab: the hours, billable hours and what they spent, the hours by member,
the latest entries and logging time against the project as the acting
member.

## Lanterne

The rate is 80 € an hour, the 560 € day rate over a seven-hour day. Since
September the Halles shop's time has spent about 16 000 € of its 48 000 €,
Ferrand's 13 760 € of its 14 000 €.
