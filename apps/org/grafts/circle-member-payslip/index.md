+++
title = "circle-member-payslip"
updated = 2026-10-25
+++

Who a pay run waits on. Approving and paying a run need powers, which
mandates on circles' roles grant to the members seated in them
(`circle-member`), so the pay runs waiting on a member join all three
feats and build on `circle-member`. Declared by `payslip`.

## Schema

None of its own: it reads `circle_member.may` and the payslip feat's runs.

## Shell

Adds to the acting member's inbox each prepared run they may approve,
holding `approve-payroll`, and each approved run not yet paid that they
may pay, holding `pay-payroll`, linking to the run's first payslip, whose
page approves or pays it.

## Lanterne

Julien, in finance, holds both; a run prepared for October waits on him.
