+++
title = "expense-invoice-project-timesheet"
updated = 2026-10-30
+++

Retired. A project's margin, its budget burn, its forecasts and its watch
are a report of the `report` feat
([the project margins](../../feats/report/index.md#the-project-margins)),
joined in the analytics shell from what `invoice-project`,
`project-timesheet` and `expense-project` publish, so no graft joins the
four feats any more. It has no code and no writes; `project` still
declares it so its migrations stay where they were applied.

## Schema

Migrations are append-only, so both stay: `sql/001` made
`expense_invoice_project_timesheet`, its thresholds and its `margin(day)`,
and `sql/002` drops all three. The thresholds are the `report` feat's.
