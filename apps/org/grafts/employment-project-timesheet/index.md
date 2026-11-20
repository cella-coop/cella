+++
title = "employment-project-timesheet"
updated = 2026-11-20
+++

A worker's week of time on projects, and the time they import, by their
employment. Booking time to a project is `project-timesheet`'s, its write
the timesheet feat's log, which needs `log-time`, every employee's
right, member or not; this graft builds the week a worker enters it in,
over the days they are employed. It joins the three feats and builds on
both. Declared by `timesheet`.

## Actions

None of its own: each cell of the week is `project-timesheet`'s `book`
for a project, or the timesheet feat's `log` for the coop's own time,
both under `timesheet:entry:log`, and judged by its guards:
`timesheet.logs`, `employment_timesheet.whose` and
`membership_timesheet.whose`, and the booking's trigger,
`project_timesheet.resolves`, a project that exists and is not archived.

## Shell

Replaces the timesheets' New form with the acting worker's week
(`weeks`): a grid (`Grid` in the UI core) with a row for each of their
projects not archived, of a circle they sit in that week, booked to in
the four weeks before or logged to in that week, those booked to first,
and the coop's own time last, the dialog widening to show the whole
week; a column for each day from Monday, open once it has come
while they are employed. Each row names the circle its time is worked
for (`circle.<project>`, `circle._` for the coop's own time),
chosen among the circles the worker sits in that week (`sitting` in
core's circles): a project's row offers the project's circle first
where they sit in it, and the coop's own time the root's, so Thomas's
row for the Halles shop, Web's, logs in his month of Web's, and a
worker who sits in no circle names none, which logs in the root's.
Each cell shows what is logged and takes the hours to add. Logging the
week (`week`) makes one write for each cell typed into, in the grid's
order, naming its row's circle: `project-timesheet`'s `book` for a
project, billable, and the timesheet feat's log for the coop's own
time, not billable; the first refusal stops the rest and is shown with
the writes before it, which stand. Their cells come back as `spent`, and
the form empties them, so logging the week again adds only what was
refused and never a cell twice. Entries are permanent, so a cell only
adds. This week or the one before; a note or an entry's kind other than
the row's is not offered there.

## Import

Time from Toggl Track's detailed report and Harvest's detailed time
report: the importers `toggl` and `harvest`, each stretch booked to the
project the coop holds under its title, or logged as the coop's own
time, as its worker's. A worker is matched by the address Toggl gives,
or by name, which Harvest gives instead; a stretch of anyone but the
importing member is refused, so each worker imports their own export
([import](../../feats/import/index.md)).

## Lanterne

InÃ¨s, employed, no member and seated in Web, books her hours to a Web
project from the grid by her right, as every worker does.
