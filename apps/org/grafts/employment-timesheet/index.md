+++
title = "employment-timesheet"
updated = 2026-10-25
+++

Whose time is, and logging it by one's employment. A worker logs and
submits their own time, member or not: their employment, not a mandate a
seat gives, is what entitles them to. Declared by `timesheet`.

## Schema

`employment_timesheet` (`sql/`):

- `employment_timesheet.whose`, a trigger on `timesheet.entry`: a worker's
  entry falls on a day of their employment, never before their hire nor
  after they leave (SQLSTATE `09000`). An entry of no worker's, a member
  who is not employed, is membership-timesheet's to judge.
- `employment_timesheet.sheet`: each worker's months by name, and who
  approved each.

## Writes

| Write | Label | Check | Why |
|---|---|---|---|
| `employment-timesheet:entry:log` | confluent | `self` | the timesheet feat's log by the worker's employment: entries add up in any order |
| `employment-timesheet:period:submit` | confluent | `self` | the timesheet feat's submit the same way: a flag the worker sets on their own month |

Each runs the timesheet feat's `logging` or `submitting` under this
graft's op, which needs no power: the feat's own log and submit need
`log-time`, which only a seat's mandate grants, and a worker who is no
member sits nowhere. Approving stays the feat's, under `approve-time`.

## Rules

- `employment_timesheet.works`, on both ops: the actor is a worker employed
  on the entry's day, or on a day of the month.
- `timesheet.logs` and `timesheet.submits`, the feat's own rules, run on
  them too: the time is the actor's own, on a day that has come, and a
  month submitted holds time.

## Tests

`ts/_tests/works.test.ts` (`cella test slice employment-timesheet`): a
worker's entries within their employment, one of no worker's left to the
members, and the rules on both ops. Whose the actor is, the `people`
scenario.

## Reads

`sheet` reads as its reader, each worker's months as their time does (`sql/002-reads.sql`).

## Shell

Replaces the timesheets collection's `log` and `submit` with these, so
everyone logs by their employment; adds each entry's worker by name, and
the hours by worker to the dashboard; to a person's page, their months,
submitting their own and approving someone else's.

## Lanterne

Inès logs seven hours a working day with the web circle, on no project
yet; her September is approved, by Julien.
