+++
title = "Payslip"
updated = 2026-10-25
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
| salary | `member`, `from`, `gross` | a monthly gross salary from a day on |
| run | `month`, `generated`, `approved?`, `approver?`, `paid?` | one per month |
| payslip | `month`, `member`, `minutes?`, `gross`, `employee`, `employer`, `net` | amounts in cents; net is gross less the employee's contributions; minutes are the worker's approved month's |

A salary and a payslip name their worker by address, as text, in a
column still called `member`; that it is a worker's, employed in the
payslip's month, is the `employment-payslip` graft's.

## Lifecycle

A run is prepared, approved, then paid, each once; its payslips never
change once it is approved.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/payslip/generate` | ordered | fixes a month's payslips from the salaries and the approved time; a month has one run |
| `POST /api/payslip/approve` | ordered | makes the run final and posts it, once |
| `POST /api/payslip/pay` | ordered | money leaves the bank for the run's pay and charges; a run is paid once |

Preparing needs the approved time, which is the `payslip-timesheet`
graft's, and approving and paying post, which is `payslip-transaction`'s:
their writes serve these ops over this feat's `generating`, `approving`
and `paying` specs. Who a run waits on, the holders of `approve-payroll`
and then of `pay-payroll`, is `circle-membership-payslip`'s, in their inbox.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| generate | `prepare-payroll`, no limit | Julien, as finance |
| approve | `approve-payroll`, no limit | Camille, as gérante |
| pay | `pay-payroll`, no limit | Julien, as finance |

Wages are owed whatever their size, so no power has a limit.

## Invariants

- a run's payslips are exactly what its salaried workers are due:
  `payslip.due(month)`, the salary in force on the month's first day and
  the contributions at the terms' rates, to the cent;
- a run is approved, then paid, each once, and its payslips are fixed
  from its approval;
- the highest gross salary of a run is at most the terms' ratio times the
  lowest: Lanterne's internal rules cap it at 1.6.

## Schema

`payslip` (`core/sql/`): `terms`, `salary`, `run`, `payslip`; `due(month)`;
`spread(month)`, why a run's pay is wider than the ratio; `stays` and
`once`, triggers raising SQLSTATE `09000`. The app role may select,
insert runs and payslips, and set a run's approval and payment and a
payslip's minutes; the rules role may select.

## Personal data

A member's salary and each payslip's figures are personal data of class
`payroll`, registered by the member's address (`003-personal.sql`): the
law keeps them five years (Code du travail, art. L3243-4). Erasing a
member who has left restricts them; once their clock runs out `cella
vault sweep` redacts them to NULL, so the figures are nullable, and
`payslip.stays` lets an approved run's payslips take that one change
(`cella.redacting()`). A run's payload holds its totals, never a
member's figures.

## Rules

- `payslip.generates`, on `payslip:run:generate`: the run was prepared by
  this write with exactly what its members are due.
- `payslip.approves`, on `payslip:run:approve`: approved by this write, as
  the actor, and within the ratio.
- `payslip.pays`, on `payslip:run:pay`: paid by this write.

## Tests

`core/ts/_tests/payslip.test.ts` (`cella test slice payslip`): what each
member is due from the salary in force; a run prepared with exactly that;
approved and paid once, its payslips fixed from its approval; the ratio.

## Reads

Who reads pay is a row-level policy (`sql/004-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)): a member reads their own salaries and payslips and the runs they are paid in; whoever holds `prepare-payroll`, `approve-payroll` or `pay-payroll` reads all of them; no one signed in reads any. A write's transaction reads every row, as the rules do.

## Shell

The `payslips` collection in Finance, a table with a dashboard of the
payroll by month (gross, net, the cost to the co-op, what awaits
payment); preparing a month's run; and a payslip's page, line by line,
with its run's approval and payment.

## Lanterne

Ten members are salaried, from 2 400 € to 3 000 € gross a month, 26 000 €
in all; contributions are 22 % for the employee and 40 % for the
employer. July to September's runs were carried over, paid on the 28th,
September's with the members' approved hours. October's waits for the
workers' months to be approved, Inès's with the members': employed since
September 2025 and not yet a member, she was paid by the previous tool
apart from the runs it carried over, and from October her 2 200 € is a
run's, so October's run holds eleven payslips, 28 200 € gross.
