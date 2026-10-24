+++
title = "member-payslip"
updated = 2026-10-24
+++

Whose a salary and a payslip are: a member's, and a payslip an active
one's. The payslip feat holds the address; this graft checks it and names
them. Declared by `payslip`.

## Schema

`member_payslip` (`sql/`): `whose`, a trigger on `payslip.salary` and
`payslip.payslip` (SQLSTATE `09000`); `slip`, each payslip with its
member's name.

## Shell

Adds the member's name to each payslip, and to a member's page their
gross salary and their payslips.
