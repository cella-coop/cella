+++
title = "expense-invoice-project-timesheet"
updated = 2026-11-04
+++

Retired. A project's margin, its budget burn, its forecasts and its watch
are a report of the `report` feat
([the project margins](../../feats/report/index.md#the-project-margins)),
joined in the analytics shell from what `invoice-project`,
`project-timesheet` and `expense-project` publish, so no graft joins the
four feats any more. It has no code and no writes; `project` still
declares it so its migrations stay.

## Schema

Its migrations stay until launch squashes the tree's: `sql/001` made
`expense_invoice_project_timesheet`, its thresholds and its `margin(day)`,
and `sql/002` drops all three. The thresholds are the `report` feat's.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
