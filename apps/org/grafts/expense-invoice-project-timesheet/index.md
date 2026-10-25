+++
title = "expense-invoice-project-timesheet"
updated = 2026-10-25
+++

A project's margin: what it invoiced less what its time cost the co-op
and what was spent for it, live, with its budget burn, the forecasts at
completion and whether it needs watching. Declared by `project`. It
joins four feats because the margin needs all three of the relationships
beneath it, `invoice-project`'s invoices, `project-timesheet`'s time and
`expense-project`'s expenses, and reads them; it has no writes.

## Schema

`expense_invoice_project_timesheet` (`sql/`):

- `expense_invoice_project_timesheet.threshold`: from a day on, when a
  project is watched: once its billable time has spent `burn` percent of
  its budget, or once its margin keeps less than `margin` percent of what
  it invoiced. A parameter, seeded with the co-op's figures; a write to
  it, and a threshold per project, are not built.
- `expense_invoice_project_timesheet.margin(day)`: each project's margin
  on a day, in cents: what it invoiced, net of VAT and of its voided
  invoices (`invoice_project.invoiced`), less what its time cost, every
  hour at the cost rate (`project_timesheet.burn`), and its approved and
  reimbursed expenses (`expense_project.spent`); that margin as a percent
  of what it invoiced; its budget burn and its spend at completion
  (`project_timesheet.forecast`); its margin at completion (`landing`),
  its budget, or what it invoiced when it has none, less its costs so far
  at the pace so far; and its `watch`.

The app role and the rules role may select the thresholds.

## Rules

A project's watch, in this order:

- `budget spent`: its burn has reached the threshold while it is under
  way, before its due day, not archived and not done;
- `over budget`: its spend at completion is beyond its budget;
- `thin margin`: it invoiced something and its margin keeps less than the
  threshold of it;
- `on track` otherwise. An archived project is watched no more.

The watch is a reading, not a refusal: no write waits on it. It becomes
an item of the "needs me" inbox when the inbox exists.

## Tests

`ts/_tests/margin.test.ts` (`cella test slice
expense-invoice-project-timesheet`): a margin leaves out a voided invoice
and a pending expense and costs every hour, billable or not; the burn and
the forecasts at the pace so far, and the spend at completion once due;
a project watched for its burn while under way and not on its due day,
for its forecast, and for a thin margin with no due day and no budget,
and no longer once archived.

## Shell

Adds to each project its margin, its margin percent, its burn, what its
time cost and its watch, as columns of the table; to the projects' header
how many are watched; to their dashboard the margin and the time cost
summed, the projects to watch and the margin by watch; and to a project's
overview its Margin: invoiced, time cost, expenses, margin and its
percent, then its burn and the spend and margin at completion, with a
line saying why it is watched; its margin and watch among its
Properties.

## Lanterne

The thresholds are a 90 % burn and a 20 % margin. On 25 October, Maison
Ferrand's packaging has spent 98 % of its budget with its last milestone
open, and Fondation Terres Vives's report, at 76 % with 45 % of its span
to go, would spend about 24 500 € of its 18 000 €; every other live project
is on track. Ferrand's margin is 9 933,92 €: 14 000 € invoiced less 172
hours at 23,64 €.
