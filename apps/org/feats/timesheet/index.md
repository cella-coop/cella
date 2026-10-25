+++
title = "Timesheet"
updated = 2026-10-25
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
books and its retainers run by the month, and patronage will sum months.
A period is **open** until its member submits it, **submitted** until
someone approves it, and **approved** for good. Time is written in
minutes, since a signed request holds integers only, and shown in hours.
The note is the member's own words and stays out of the log.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `timesheet:entry:log` | confluent | `log-time` | entries add up in any order |
| `timesheet:period:submit` | confluent | `log-time` | a flag the member sets on their own month; submitting again keeps the first day |
| `timesheet:period:approve` | ordered | `approve-time` | closes the month to new entries: it fixes which entries were approved |

A log and an approval of its month do not commute: logged first, the
entry is in what was approved; approved first, it is refused. Approval is
therefore ordered, as closing a period of the books is, and every log
stays confluent. At rung 1 the entry's trigger reads its period `FOR
SHARE` and the approval updates it, so Postgres serialises the two.

## Powers

| Power | Lanterne |
|---|---|
| `log-time` | every member, through the `member` role's mandate |
| `approve-time` | the circle leads, finance and the gérante |

Logging and submitting are also the member's own (`timesheet.logs`,
`timesheet.submits`), and approving never is (`timesheet.approves`).
`002-powers.sql` registers the powers in `cella.power`, and the
`circle-member` graft checks them; that a lead approves only their own
circle's members is `circle-member-timesheet`'s. A worker logs and
submits their own time by their employment instead, member or not,
through `timesheet-worker`'s writes of the same effect, which need no
mandate: the shell logs through those, since a worker who is no member
holds no seat and so no `log-time`.

## Invariants

- an entry is the actor's own time, on a day that has come
  (`timesheet.logs`);
- an entry is more than no time and at most a day;
- no entry goes into an approved month (`timesheet.open_period`,
  SQLSTATE `09000`);
- a month is submitted by its member and holds time (`timesheet.submits`);
- a month is approved once it is over, only once submitted, by someone
  other than its member, and stays approved (`timesheet.approves`,
  `timesheet.stays_approved`).

A day of more than 24 hours across entries is not refused, since two
entries logged apart can each pass and together exceed it; the fixture
check keeps Lanterne's days plausible. Entries are permanent: an edit or
a deletion is not built, so a mistake is corrected only in a later month.

## Schema

`timesheet` (`core/sql/`): `timesheet.entry`, `timesheet.period` and
`timesheet.sheet`, each month's hours, billable hours, entries and state.
The app role may select and insert entries and update periods; the rules
role may select.

## Shell

The `timesheets` collection lists every entry in a table, the latest day
first, with its worker and project from the grafts; its dashboard sums
the hours, the billable hours and those awaiting approval, by month and
by kind, and by worker and by project from the grafts. Its New form logs
time as the acting worker, by their employment (`timesheet-worker`). An
entry's page shows its worker's month and, in its header, submits it
while open or approves it once submitted; a worker's page and a member's
list their months with the same writes (`timesheet-worker`,
`member-timesheet`).

## Lanterne

Timesheets began on 1 September 2026. Every worker logs seven hours a
working day, the 35-hour week of the internal rules, under a third of it
billable, in line with what the invoices bill at the 80 € hourly rate.
September is submitted by everyone and approved: each lead approved their
circle's members, Julien in finance the leads and Inès, who is no member
yet, and Camille as gérante Julien. October is open.
