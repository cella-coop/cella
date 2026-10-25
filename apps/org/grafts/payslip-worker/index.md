+++
title = "payslip-worker"
updated = 2026-10-25
+++

Whose pay is: a worker's, member or not. The payslip feat holds the
address on each salary and payslip; this graft checks it against the
workers and names them. Declared by `payslip`. It replaces
member-payslip's check against the members, which kept a worker who is
no member off the payroll.

## Schema

`payslip_worker` (`sql/`): `payslip_worker.whose`, a trigger on
`payslip.salary` and `payslip.payslip` (SQLSTATE `09000`): a salary is a
worker's, and a payslip one employed on some day of its month, so a
worker is paid for the month they leave and none after;
`payslip_worker.slip`, each payslip with its worker's name and job.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice payslip-worker`): a salary
of no worker's refused; Inès's payslip though she is no member; Paul's
for the month he left and none after.

## Shell

Adds each payslip's worker by name, and to the workers collection each
one's salary in force; to a worker's page, their gross salary and their
payslips.

## Lanterne

Inès's 2 200 € is October's run's, with the ten members'.
