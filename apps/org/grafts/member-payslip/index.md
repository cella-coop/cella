+++
title = "member-payslip"
updated = 2026-10-25
+++

A member's pay on their page. Declared by `payslip`. Whose a salary and a
payslip are is `payslip-worker`'s: a worker's, member or not, employed in
the payslip's month, so a worker who is no member is paid as any other.

## Schema

`member_payslip` (`sql/`) holds nothing: `002-employment.sql` drops the
check against the members and the view naming payslips by member that
`001-member-payslip.sql` made.

## Shell

Adds to a member's page their gross salary and their payslips.
