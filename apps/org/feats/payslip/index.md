+++
title = "Payslip"
updated = 2026-11-20
+++

Pay: each worker's salary, member or not, and a pay run each month, one
payslip per salaried worker, prepared from the salaries and the
workers' approved time, approved, and paid from the bank. It is the
document layer, not a payroll engine: contributions are flat rates until
a payroll integration computes them line by line.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| terms | `employee`, `employer`, `ratio` | the contributions' rates on gross pay, in percent, and the widest ratio between the highest and the lowest salary |
| salary | `member`, `from`, `until?`, `gross` | a monthly gross salary from a day on, until its last day where it has one; in force on each day between, both included |
| run | `month`, `generated`, `approved?`, `approver?`, `paid?` | one per month |
| payslip | `month`, `member`, `minutes?`, `gross`, `employee`, `employer`, `net` | amounts in cents; net is gross less the employee's contributions; minutes are the worker's approved month's |

A salary and a payslip name their worker by address, as text, in a
column still called `member`; that it is a worker's, employed in the
payslip's month, is the `employment-payslip` graft's.

## Lifecycle

A run is prepared, approved, then paid, each once; its payslips never
change once it is approved.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/payslip/generate` | ordered | fixes a month's payslips from the salaries and the approved time; a month has one run |
| `POST /api/payslip/approve` | ordered | makes the run final and posts it, once |
| `POST /api/payslip/pay` | ordered | money leaves the bank for the run's pay and charges; a run is paid once |

Preparing needs the approved time, which is the `payslip-timesheet`
graft's, and approving and paying post, which is `payslip-transaction`'s:
their writes serve these actions over this feat's `generating`, `approving`
and `paying` specs; `payslip-timesheet` sets each payslip's minutes
through this feat's `timing`, inside the write that generates the run.
Who a run waits on, the holders of `approve-payroll`
and then of `pay-payroll`, is `membership-payslip`'s, in their inbox.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| generate | `prepare-payroll`, no limit | Julien, as finance |
| approve | `approve-payroll`, no limit | Camille, as manager |
| pay | `pay-payroll`, no limit | Julien, as finance |

Wages are owed whatever their size, so no power has a limit.

## Invariants

- a run's payslips are exactly what its salaried workers are due:
  `payslip.due(month)`, the salary in force on the month's first day and
  the contributions at the terms' rates, to the cent, so a salary that
  ended before the month is due nothing in it;
- a run is approved, then paid, each once, and its payslips are fixed
  from its approval;
- the highest gross salary of a run is at most the terms' ratio times the
  lowest: Lanterne's internal rules cap it at 1.6.

## Schema

`payslip` (`core/sql/`): `terms`, `salary`, `run`, `payslip`; `due(month)`;
`spread(month)`, why a run's pay is wider than the ratio; `stays` and
`once`, triggers raising SQLSTATE `09000`. The app role may select,
insert runs and payslips, and set a run's approval and payment and a
payslip's minutes; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Personal data

A member's salary and each payslip's figures and minutes are personal
data of class `payroll`, registered by the member's address
(`003-personal.sql`): the law keeps them five years (Code du travail, art. L3243-4). Erasing a
member who has left restricts them; once their clock runs out `cella
vault sweep` redacts them to NULL, so the figures are nullable, and
`payslip.stays` lets an approved run's payslips take that one change
(`cella.redacting()`). A run's payload holds its totals; the write that
generates it holds each payslip's figures too, by commitment, and
payslip-timesheet's each payslip's minutes, so the log keeps a salted
digest of every member's pay, never the figures.

## Body

A payslip keeps a body, its free-form discussion, a Loro snapshot of core body's blocks, saved by `payslip:body:save` (`sql/006-body.sql`), keyed by its generated `id`, `<month>~<member>`. A save needs `discuss` in the record's circle and that the saver reads the record, by the terms of its row-level policy rather than the whole state a write's transaction sees (`payslip.legible`), and `based` refuses one that did not merge the body it replaces.

`payslip.stays` leaves the body free: an update that changes no other column, keys included, passes once the record is fixed and when repeated, and one that changes another column beside it is refused as that column alone is.

`core/ts/_tests/body.test.ts` saves a body after the record is fixed, again the same and by its fold, and is refused with another column beside it, and by one who does not read the record.

## Guards

- `payslip.generates`, on `payslip:run:generate`: the run was prepared by
  this write with exactly what its members are due.
- `payslip.approves`, on `payslip:run:approve`: approved by this write, as
  the actor, and within the ratio.
- `payslip.pays`, on `payslip:run:pay`: paid by this write.

## Folds

Each action folds by `sql/005-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
a run prepared on its entry's day with a payslip for each member its
figures name, every figure as its commitment, since `payslip.due`
reads salaries the log keeps no value of; an approval by the entry's
actor and a payment, on their entries' days. payslip-timesheet folds a
payslip's minutes, payslip-transaction the entries a run posts.

## Tests

`core/ts/_tests/payslip.test.ts` (`cella test slice payslip`): what each
member is due from the salary in force, and nothing once it has ended;
a run prepared with exactly that;
approved and paid once, its payslips fixed from its approval; the ratio.

## Reads

Who reads pay is a row-level policy (`sql/004-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)): a member reads their own salaries and payslips and the runs they are paid in; whoever holds `prepare-payroll`, `approve-payroll` or `pay-payroll` reads those of the circles their mandate covers, the whole coop's at Lanterne; `read` opens none of it, since the feat's own policy replaces core's; no one signed in reads any. A write's transaction reads every row, as the guards do.

## Shell

The `payslips` collection in Payments, a list grouped by the pay run's
month, the latest first, each payslip titled by the person it pays, with
its gross, its net and its run; preparing a month's run; and a payslip's page with its
run's approval and payment, laid out as `panels` ([record page
layout](../../../../_corpus/doc/architecture.md#record-page-layout)),
with no tab: it opens on its Pay, the payslip line by line, its net pay
and its cost ruled off, then what its extenders add and its Notes, its
body.

## Lanterne

Ten members are salaried, from 2 400 € to 3 000 € gross a month, 26 000 €
in all; contributions are 22 % for the employee and 40 % for the
employer. July to September's runs were carried over, paid on the 28th,
September's with the members' approved hours. October's waits for the
workers' months to be approved, Inès's with the members': employed since
September 2025 and not yet a member, she was paid by the previous tool
apart from the runs it carried over, and from October her 2 200 € is a
run's, so October's run holds eleven payslips, 28 200 € gross.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `payslip.months` to the analytics shell: each month's payroll summed over every payslip, and its run's days. A payslip is its member's, so no row is one member's pay. It is shared by `month`. Each month is counted: `payslip.months_contributions` holds each person's gross pay in it, which only the port reads, to withhold a month from a reader where open books does not share it ([what is withheld](../../core/analytics/index.md#what-is-withheld)). Each of its views but the contributions is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
