+++
title = "Timesheet"
updated = 2026-11-17
+++

Time worked, by worker and day, member or not, and each worker's
timesheet, a month of it in each circle they work for, which they submit
and someone else approves. Approved time is what payslips hold and a
work share by time divides, and it is counted against projects' budgets.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| entry | `id`, `circle`, `member`, `day`, `minutes`, `billable`, `note` | the member's address; whole minutes, at most a day |
| period | `circle`, `member`, `month`, `submitted?`, `approved?`, `approver?` | `month` is `YYYY-MM`; one per circle, member and month |

A period is a **month**, not seedling's week: Lanterne's payroll, its
books and its retainers run by the month, and the work share by time
worked sums approved months (`patronage-timesheet`).
A period is a member's month **in one circle**: time a member works for
Web and for Brand in October is two months, Web's and Brand's, each
submitted and approved apart, so approving Web's closes only Web's
entries to new time and Brand's month stays open.
A period is **open** until its member submits it, **submitted** until
someone approves it, and **approved** for good. Time is written in
minutes, since a signed request holds integers only, and shown in hours.
The note says what the time was spent on, the co-op's work record, not
personal data (`003-personal.sql`): a log carries it as written and
its fold writes it again. An entry's minutes are personal data of class
`payroll`, registered by the member's address (`006-salted.sql`): a log
and a correction commit to them, and the vault keeps them, so the log's
digest confirms no guess at a colleague's time. Erasing a member who
has left restricts them; once their clock runs out `cella vault sweep`
redacts them to NULL, the one change an approved month's entries take
(`cella.redacting()`), and every sum passes them over.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `timesheet:entry:log` | confluent | `log-time` | entries add up in any order |
| `timesheet:entry:correct` | confluent | `log-time` | lowers the member's own entry, to none where none was worked: two corrections leave the lower in any order |
| `timesheet:period:submit` | confluent | `log-time` | a flag the member sets on their own month; submitting again keeps the first day |
| `timesheet:period:approve` | ordered | `approve-time` | closes the month to new entries: it fixes which entries were approved |

A log or a correction and an approval of its month do not commute:
logged or corrected first, the entry is in what was approved as it then
stands; approved first, it is refused. Approval is therefore ordered, as
closing a period of the books is, and every log and correction stays
confluent. At rung 1 the entry's triggers read its period `FOR SHARE` and
the approval updates it, so Postgres serialises them.

## Powers

| Power | Lanterne |
|---|---|
| `log-time` | every employee, by their right, member or not |
| `approve-time` | the circle leads, finance and the manager |

Logging, correcting and submitting are also the member's own
(`timesheet.logs`, `timesheet.corrects`, `timesheet.submits`), and
approving never is (`timesheet.approves`).
`002-powers.sql` registers the powers in `cella.power`, and the
membership feat checks them; that a lead approves only the time
of those seated in their circle is `membership-timesheet`'s.
`log-time` is every employee's right, held with no seat from the first
day of their contract to its last, member or not: what a worker logs is
their own, and a right opens no one else's time to read, as a seat's
mandate would ([rights](../../core/circle/index.md#rights)). Whose time an entry
is on its day, within the worker's employment and no suspended or former
member's, is `employment-timesheet`'s and `membership-timesheet`'s.

## Invariants

- an entry is the actor's own time, on a day that has come
  (`timesheet.logs`);
- an entry is logged as more than no time (`timesheet.some_time`) and
  is at most a day;
- an entry changes only by lowering its time, to none at the least, and
  is the actor's own (`timesheet.lowers`, `timesheet.corrects`);
- an entry's month is its circle's, the month of its circle, member and
  day (`timesheet.open_period`);
- no entry goes into an approved month, nor is corrected in one
  (`timesheet.open_period`, `timesheet.lowers`, SQLSTATE `09000`);
- a month is submitted by its member and holds time of its circle
  (`timesheet.submits`);
- a month is approved once it is over, only once submitted, by someone
  other than its member, and stays approved (`timesheet.approves`,
  `timesheet.stays_approved`).

A day of more than 24 hours across entries is not refused, since two
entries logged apart can each pass and together exceed it; the fixture
check keeps Lanterne's days plausible. A mistake is corrected before
the month is approved: an entry typed too high is lowered, to none where
none was worked, and the log keeps what it was logged as and each
correction; time missed is an entry of its own. Once the month is
approved its entries stand, and correcting one then is not built.

## Schema

`timesheet` (`core/sql/`): `timesheet.entry`, `timesheet.period` and
`timesheet.sheet`, each month's hours, billable hours, entries and state,
summed over the entries of its circle, member and month.
The app role may select and insert entries, update their minutes, and
update periods; the guards role may select. A month's `entries` counts
those with time in them.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
An entry names the circle its time is worked for (`circle` in its log),
and its month is that circle's: the first entry of a member's month in a
circle makes the month there, so a month of Web's holds Web's time and
no other circle's. Every write on a month, its submission and its
approval, names the month's circle in its request and its payload,
which core's guard on every power reads a mandate's scope against: a
lead approves their own circle's months and is refused another's, the
refusal naming the circle
([who may act](../../core/grafts/circle-person/index.md#who-may-act)).

## Folds

Each action folds by `sql/007-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
an entry under the id the entry names, its note as written and its minutes as their
commitment, the feat's trigger making the member's month as it did. An
entry is logged with its time, so its minutes fold as one, the least an
entry holds, as a carried number that takes no null does. A correction
keeps the commitment to the minutes it brought the entry to; a month
folds submitted, keeping its first day, and approved by the entry's
actor, on their entries' days.

## Reads

Who reads time is a row-level policy (`sql/004-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)): a member reads their own entries, months and sheets; whoever holds `approve-time`, `prepare-payroll` or `distribute-surplus` reads those of the circles their mandate covers, so Web's lead reads Web's time and the Treasurer everyone's; `read` opens none of it, since the feat's own policy replaces core's; no one signed in reads any. `timesheet.sheet` reads as its reader. A write's transaction reads every row.

## Shell

The `timesheets` collection lists every entry in a table grouped by where
its month stands, open, submitted (the approval queue) and approved, the
latest day first, with its worker, a person, and its project from the
grafts; its dashboard sums
the hours, the billable hours and those awaiting approval, by month and
by kind, and by worker and by project from the grafts. Its New form is the
acting worker's week (`employment-project-timesheet`): a project to a row,
the co-op's own time last, and a day to a column, each cell adding the
hours typed into it, the feat's log, booked to the row's project by
`project-timesheet`; the feat's own one-entry form, with a note, is what
that replaces. Each row names the circle its time is worked for, chosen
by the worker among the circles they sit in, and its hours log in that
circle's month: a project's row offers the project's circle first where
the worker sits in it, and the co-op's own time the root's, so time
logged from the shell lands in the month of the circle it was worked
for and is approved by whoever holds `approve-time` over that circle. An entry's page is titled by its note, or without one its hours and day,
its header's crumb its id, and its Month tab shows its worker's month; in its
header, it lets its worker correct the entry's hours down while the month is not approved,
and submits the entry's month, its circle's, while open or approves it
once submitted; a person's page lists their months, a row for each
circle's, with the same writes (`employment-timesheet`).

## Lanterne

Timesheets began on 1 September 2026. Every worker logs seven hours a
working day, the 35-hour week of the internal rules, under a third of it
billable, in line with what the invoices bill at the 80 € hourly rate.
Each works for one circle, so each has one month a month, which the
fixture names with its circle as it names their entries', but for the
last week of October, when Camille gives part of hers to coordination
and the assembly and Julien an hour a day to the assembly's accounts.
September is submitted by everyone and approved: each lead approved their
circle's, Julien in finance the leads and Inès, who is no member yet
and sits in Web, and Camille as manager Julien. Inès logs hers by her
right as every worker does. October is open, but for Sofia's, submitted
early for Hugo to approve. October's months are approved by the same
hands: Camille as manager approves each worker's, Sofia's once it is
submitted already, and Julien as treasurer approves Camille's own in
coordination and the assembly, which no lead's mandate reaches, since
a lead's `approve-time` holds on their own circle alone.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `timesheet.months` to the analytics shell: each month's time in minutes, summed over every entry. An entry is its member's, so no row is one member's time. It is shared by `month`. Each month is counted: `timesheet.months_contributions` holds each person's minutes in it, which only the port reads, to withhold a month from a reader where open books does not share it ([what is withheld](../../core/analytics/index.md#what-is-withheld)). Each of its views but the contributions is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.

## Body

An entry keeps a body, its free-form discussion, a Loro snapshot of core body's blocks, saved by `timesheet:body:save` (`sql/008-body.sql`). A save needs `discuss` in the record's circle and that the saver reads the record, by the terms of its row-level policy rather than the whole state a write's transaction sees (`timesheet.legible`), and `based` refuses one that did not merge the body it replaces.

`timesheet.lowers` leaves the body free: an update that changes no other column, keys included, passes once the record is fixed and when repeated, and one that changes another column beside it is refused as that column alone is.

`core/ts/_tests/body.test.ts` saves a body after the record is fixed, again the same and by its fold, and is refused with another column beside it, and by one who does not read the record.
