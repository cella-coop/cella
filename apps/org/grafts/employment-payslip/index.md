+++
title = "employment-payslip"
updated = 2026-10-25
+++

Whose pay is: a worker's, member or not. The payslip feat holds the
address on each salary and payslip; this graft checks it against the
workers and names them. Declared by `payslip`. A worker's pay shows on
their person's page once, by their employment, whether or not they are
a member.

## Schema

`employment_payslip` (`sql/`): `employment_payslip.whose`, a trigger on
`payslip.salary` and `payslip.payslip` (SQLSTATE `09000`): a salary is a
worker's, and a payslip one employed on some day of its month, so a
worker is paid for the month they leave and none after;
`employment_payslip.slip`, each payslip with its worker's name and job.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice employment-payslip`): a salary
of no worker's refused; Inès's payslip though she is no member; Paul's
for the month he left and none after.

## Shell

Adds each payslip's worker by name, and to the people collection each
one's salary in force; to a person's page, their gross salary and their
payslips.

## Lanterne

Inès's 2 200 € is October's run's, with the ten members'.
