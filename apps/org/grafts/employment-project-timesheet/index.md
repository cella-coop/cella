+++
title = "employment-project-timesheet"
updated = 2026-11-01
+++

A worker's time on projects by their employment, and the week they enter
it in. Booking time to a project is `project-timesheet`'s, but its write
is the timesheet feat's log, which needs the log-time mandate that only
a seat, and so a membership, gives; logging by employment, member or not,
is `employment-timesheet`'s. This graft joins the three feats and builds on
both. Declared by `timesheet`.

## Actions

| Action | Label | Check | Why |
|---|---|---|---|
| `employment-project-timesheet:entry:book` | confluent | `self` | entries add up in any order; the worker's own, while employed |

`book` is `project-timesheet`'s booking (`booking`) over the timesheet
feat's entry, under this graft's op: one transaction, one verdict. The
guards are those of employment-timesheet's log, `timesheet.logs` and
`employment_timesheet.works`, registered on this action by `sql/`; the booking's
trigger, `project_timesheet.resolves`, wants a project that exists and is
not archived.

## Shell

Replaces the timesheets' New form with the acting worker's week
(`weeks`): a grid (`Grid` in the UI core) with a row for each project not
archived, those they booked to in the four weeks before first, and the
co-op's own time last; a column for each day from Monday, open once it
has come while they are employed. Each cell shows what is logged and
takes the hours to add. Logging the week (`week`) makes one write for
each cell typed into, in the grid's order: this graft's `book` for a
project, billable, and `employment-timesheet`'s log for the co-op's own time,
not billable; the first refusal stops the rest and is shown with the
writes before it, which stand. Their cells come back as `spent`, and the
form empties them, so logging the week again adds only what was refused
and never a cell twice. Entries are permanent, so a cell only
adds. This week or the one before; a note or an entry's kind other than
the row's is not offered there.

## Import

Time from Toggl Track's detailed report and Harvest's detailed time
report: the importers `toggl` and `harvest`, each stretch booked to the
project the co-op holds under its title, or logged as the co-op's own
time, as its worker's by their employment. A worker is matched by the
address Toggl gives, or by name, which Harvest gives instead; a stretch of
anyone but the importing member is refused, so each worker imports their
own export ([import](../../feats/import/index.md)).

## Lanterne

Inès, employed and no member, books her hours to Maison Ferrand's
packaging from the grid, where project-timesheet's booking refuses her:
she holds no seat, so no log-time mandate.
