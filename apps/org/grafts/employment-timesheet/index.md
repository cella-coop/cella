+++
title = "employment-timesheet"
updated = 2026-11-06
+++

Whose time is, by one's employment. A worker logs, corrects and submits
their own time, member or not, through the timesheet feat's own writes,
which need `log-time`, every employee's right; this graft says that an
entry falls within its worker's employment, and shows each worker's
months by name. Declared by `timesheet`.

## Schema

`employment_timesheet` (`sql/`):

- `employment_timesheet.whose`, a guard on `timesheet:entry:log`: a
  worker's entry falls on a day of their employment, never before their
  hire nor after they leave. An entry of no worker's, a member who is not
  employed, is membership-timesheet's to judge.
- `employment_timesheet.sheet`: each worker's months by name, one for
  each circle they worked for, and who approved each.

The graft has no action of its own: logging, correcting, submitting and
approving are the timesheet feat's.

## Tests

`ts/_tests/works.test.ts` (`cella test slice employment-timesheet`): a
worker's entries within their employment, one of no worker's left to the
members, and the guard on the feat's log. Whose the actor is, the
`people` scenario; a correction from an entry's page, `participation`.

## Reads

`sheet` reads as its reader, each worker's months as their time does (`sql/002-reads.sql`).

## Shell

Adds each entry's worker by name to the timesheets collection, and the
hours by worker to the dashboard; to a person's page, their months, a
row for each circle's, submitting their own and approving someone
else's, the timesheet feat's writes. Its forms name a month as its row
is keyed, `YYYY-MM/<circle>`, so a write names the month's circle.

## Lanterne

Inès logs seven hours a working day with the web circle, where she sits,
on no project yet; her September is approved, by Julien.
