+++
title = "employment-payslip"
updated = 2026-11-03
+++

Whose pay is: a worker's, member or not. The payslip feat holds the
address on each salary and payslip; this graft checks it against the
workers and names them. Declared by `payslip`. A worker's pay shows on
their person's page once, by their employment, whether or not they are
a member.

## Schema

`employment_payslip` (`sql/`): `employment_payslip.whose`, a guard on
`payslip:run:generate`: every payslip of the run is a worker's employed
on some day of its month, so a worker is paid for the month they leave
and none after. No op writes a salary; a run turns each into a payslip,
so a salary of no worker's is refused there. The last salary of a worker
whose contract names its last day ends no later than that day, and one
with no end or a later one is refused there too, so a worker who leaves
has no salary in force after they leave.
`employment_payslip.slip`, each payslip with its worker's name and job.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice employment-payslip`): a run
holding a payslip of no worker's refused; Inès's payslip though she is
no member; Paul's for the month he left and none after, his salary
ending on his last day; a salary running past its worker's last day, or
with no end where the contract names one, refused; the guard is on the
run and no trigger on the payslip feat's tables.

## Reads

`slip` reads as its reader, each worker's payslips as their pay does (`sql/002-reads.sql`).

## Shell

Adds each payslip's worker by name, and to the people collection each
one's salary in force; to a person's page, their gross salary and their
payslips.

## Lanterne

Inès's 2 200 € is October's run's, with the ten members'.
