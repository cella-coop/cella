+++
title = "Timesheet"
updated = 2026-11-01
+++

Time worked, by worker and day, member or not, and each worker's
timesheet, a month of it, which they submit and someone else approves.
Approved time is what payslips hold and a work share by time divides,
and it is counted against projects' budgets.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| entry | `id`, `member`, `day`, `minutes`, `billable`, `note` | the member's address; whole minutes, at most a day |
| period | `member`, `month`, `submitted?`, `approved?`, `approver?` | `month` is `YYYY-MM` |

A period is a **month**, not seedling's week: Lanterne's payroll, its
books and its retainers run by the month, and the work share by time
worked sums approved months (`patronage-timesheet`).
A period is **open** until its member submits it, **submitted** until
someone approves it, and **approved** for good. Time is written in
minutes, since a signed request holds integers only, and shown in hours.
The note is the member's own words and stays out of the log.
An entry's minutes are personal data of class `payroll`, registered by
the member's address (`006-salted.sql`): a log and a correction commit
to them, and the vault keeps them, so the log's digest confirms no
guess at a colleague's time. Erasing a member who has left restricts
them; once their clock runs out `cella vault sweep` redacts them to
NULL, the one change an approved month's entries take
(`cella.redacting()`), and every sum passes them over.

## Writes

| Write | Label | Power | Why |
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
| `log-time` | every member, through the `member` role's mandate |
| `approve-time` | the circle leads, finance and the gérante |

Logging, correcting and submitting are also the member's own
(`timesheet.logs`, `timesheet.corrects`, `timesheet.submits`), and
approving never is (`timesheet.approves`).
`002-powers.sql` registers the powers in `cella.power`, and the
`circle-membership` graft checks them; that a lead approves only their own
circle's members is `circle-membership-timesheet`'s. A worker logs and
submits their own time by their employment instead, member or not,
through `employment-timesheet`'s writes of the same effect, which need no
mandate: the shell logs through those, since a worker who is no member
holds no seat and so no `log-time`.

## Invariants

- an entry is the actor's own time, on a day that has come
  (`timesheet.logs`);
- an entry is logged as more than no time (`timesheet.some_time`) and
  is at most a day;
- an entry changes only by lowering its time, to none at the least, and
  is the actor's own (`timesheet.lowers`, `timesheet.corrects`);
- no entry goes into an approved month, nor is corrected in one
  (`timesheet.open_period`, `timesheet.lowers`, SQLSTATE `09000`);
- a month is submitted by its member and holds time (`timesheet.submits`);
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
`timesheet.sheet`, each month's hours, billable hours, entries and state.
The app role may select and insert entries, update their minutes, and
update periods; the guards role may select. A month's `entries` counts
those with time in them.

## Reads

Who reads time is a row-level policy (`sql/004-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)): a member reads their own entries, months and sheets; whoever holds `approve-time`, `prepare-payroll` or `distribute-surplus` reads everyone's; no one signed in reads any. `timesheet.sheet` reads as its reader. A write's transaction reads every row.

## Shell

The `timesheets` collection lists every entry in a table, the latest day
first, with its worker and project from the grafts; its dashboard sums
the hours, the billable hours and those awaiting approval, by month and
by kind, and by worker and by project from the grafts. Its New form is the
acting worker's week (`employment-project-timesheet`): a project to a row,
the co-op's own time last, and a day to a column, each cell adding the
hours typed into it by their employment, booked to the row's project;
the feat's own one-entry form, with a note, is what that replaces. An
entry's page shows its worker's month and, in its header, lets its
member correct the entry's hours down while the month is not approved,
and submits the month while open or approves it once submitted; a
person's page lists their months with the same writes (`employment-timesheet`,
`membership-timesheet`).

## Lanterne

Timesheets began on 1 September 2026. Every worker logs seven hours a
working day, the 35-hour week of the internal rules, under a third of it
billable, in line with what the invoices bill at the 80 € hourly rate.
September is submitted by everyone and approved: each lead approved their
circle's members, Julien in finance the leads and Inès, who is no member
yet, and Camille as gérante Julien. October is open.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `timesheet.months` to the analytics shell: each month's time in minutes, summed over every entry. An entry is its member's, so no row is one member's time.
