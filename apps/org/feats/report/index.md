+++
title = "Report"
updated = 2026-11-08
+++

The co-op's reports: what the books and the work add up to, read through
the [analytics port](../../core/analytics/index.md) and drawn with core/ui's
sheets, tables and charts. A report only describes: it reads the views the
slices publish in their analytical contracts, joined in the analytics
shell, on one snapshot stamped with the log's head, and no write waits on
it ([architecture](../../../../_corpus/doc/architecture.md#the-analytics-shell)).
It imports no feat: what it knows of the books, the projects and a year's
distribution is what their contracts share.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| report | `id`, `title`, `caption`, `kind`, `definition?`, `owner?`, `saved` | a saved report: one of the four the feat draws itself, or a member's own |
| threshold | `since`, `burn`, `margin` | from a day on, when a project is watched: its billable time has spent `burn` percent of its budget, or its margin keeps less than `margin` percent of what it invoiced |

A report's `kind` says how it is drawn:

- `income` and `balance`, the **financial statements**: the income
  statement over a span and the balance sheet at its end, each against
  the span before it, rubric by rubric in the PCG's presentation;
- `margins`, the **project margins**: each project's margin, its budget
  burn, its forecasts at completion and whether it is watched, on the
  scope's day;
- `federation`, the **federation figures**: a distributed year's split,
  what its entry posted, the capital it credited and the parts of its
  work share, which a SCOP reports to its federation;
- `custom`, a member's own: a port report, its `definition`, saved with
  how it is charted.

The four the feat draws itself are rows its migration makes in a
registry, `report.drawn`, owned by no one; a custom report is its
`owner`'s, saved on the verdict date, a row of `report.report`.

## The financial statements

The spans are the account feat's (`account.spans`): each month, quarter
and year the books hold, against the span of the same length before it.
A statement reads, through the port, the journal by account and day
(`account_transaction.movements`) joined to where each account is
presented (`account.placements`) and to its label (`account.chart`): a
line's figure is the sum of its accounts', signed by its rubric's side,
debit positive on the debit side and credit positive on the credit side;
a total's, its lines added and subtracted as `account.totals` expands it;
a heading's, none. The income statement sums the entries dated within
the span; the balance sheet, every entry up to its last day. A line
nothing posted to in either span is left out, and a line opens on its
accounts, each linking to its ledger.

A member's capital account is summed into its parent's code by the
movements, so a statement's line on capital shows `1013` whole and never
one member's account. Every figure equals the account-transaction graft's
`statement` to the cent, which draws the same sheet in SQL for the
patronage feat's surplus.

## The project margins

Each project's margin on the scope's day, in cents, read through the port
from the project (`project.projects`), what it invoiced net of VAT and of
its voided invoices (`invoice_project.totals`), what its time spent and
cost and its burn and spend forecast at completion
(`project_timesheet.forecasts`), and its approved and reimbursed expenses
(`expense_project.totals`), a project with no invoice or no expense
meeting none:

- its margin, what it invoiced less what its time cost and its expenses,
  and that margin as a percent of what it invoiced;
- its margin at completion (`landing`): its budget, or what it invoiced
  when it has none, less its costs so far at the pace so far;
- its watch, by the threshold in force on the day, in this order:
  `budget spent`, its burn has reached the threshold while it is under
  way, before its due day; `over budget`, its spend at completion is
  beyond its budget; `thin margin`, it invoiced something and its margin
  keeps less than the threshold of it; `on track` otherwise; and none
  once archived.

The watch is a reading, not a refusal: no write waits on it. A threshold
per project is not built.

## The federation figures

A distributed year, the latest unless the address names one (`year`), read
through the port: its surplus and split, each share's percent and amount
(`patronage.distributions`, `patronage.shares`); what its entry and the
credits that follow it posted, account by account, a member's capital account summed into its parent's
code (`account_membership_patronage_transaction.posted`); the capital it
credited, how many members, how many shares and until when
(`account_membership_patronage_transaction.credits`); its work share by
basis (`patronage.parts`); the members active and the legal reserve as the books
stand (`membership.members`, `account_transaction.movements`). Each figure it shares with the return
on a distribution's page (`account_membership_patronage_transaction.federation`)
is that figure, and what the entry posted to each reserve is that share.

A member's own statement is not a report: what a year's distribution
gave one member is theirs, which no contract shares, so it stays on the
patronage feat's statements, read under its row-level policy.

## Custom reports

A custom report is a port report as JSON: the views it reads, how they
join, its fields, filters, measures and order
([a report](../../core/analytics/index.md#a-report)), and, to chart it,
`chart`: the field its bars run over and the measure or field they
measure. Its page runs it and draws its rows as a table and its chart;
what the port refuses it shows with every reason. It runs for whoever
opens it, never for whoever saved it: where it reads a scoped view, the
server hands the port that reader and their circles
([the reader](../../core/analytics/index.md#the-reader)), so two members
running one report each read the rows their own mandates open. Saving
one checks it against the catalog; reading its rows is the run's
reader's alone.

## Lifecycle

A built-in report is made by the migration and never changes. A custom
report is saved, and saved again under its id by its owner.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/report/save` | confluent, `save-report` | a member's own report, by their right; the last save wins |

## Powers

| Action | Power | Lanterne |
|---|---|---|
| save | `save-report`, every member's right: their own | every member |

## Guards

`report.saves(payload)`, registered on `report:report:save`: the report
saved is the actor's, saved on the verdict date, a `custom` one with a
definition reading at least one view; a built-in report or another
member's is never saved over.

## Folds

A save folds by `report.fold_save` (`sql/002-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)): the actor's report as its entry
keeps it, its title, caption and definition, saved on the entry's day,
or saved again over their own; another's keeps its row, as it did when
the guard refused the write.

## Handlers

`save` (`report:report:save`) checks the definition against the port's
catalog first, so a report the port would refuse is refused with its
reasons and never saved, then upserts the actor's report.

## Schema

`report` (`sql/`):

- `report.drawn`: the four reports the feat draws itself, a registry its
  migration fills.
- `report.report`: the members' own reports.
- `report.listed`: both, as the collection lists them. It reads as its reader.
- `report.threshold`: the watch's thresholds by the day they apply from.
- `report.saves(payload)`: the save's guard.

The app role reads the tables and the list and writes reports; the
guards role reads the tables.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`report.drawn`, the four reports the feat draws itself, is a registry
and names none; `report.listed` lists them with the members' own.

## Tests

`core/ts/_tests/report.test.ts` (`cella test slice report`): the built-in
reports are there; a custom report saves under the actor, and saves again
over their own; another's, a built-in one and one reading no view are
refused. The e2e scenario `reports` checks the rest on Lanterne through a
running shell: every span's statements equal `statement` to the cent; the
margins on 25 October and a write moving one; the federation figures of
2025 against the return; a custom report saved, run and refused; and
the pages.

## Reads

Every member reads every saved report and runs it: its rows are what the
contracts share, which name no one but where a column declares it.

## Shell

The `reports` collection, titled Reports, in Office: each saved report
with its kind, the built-in ones first. A report's page draws it: the
statements as two `Sheet`s, the span's figure and the span before's, its
spans listed above it to move between (`span`); the margins as a table
over a summary of the margin, the time cost and how many are watched; the
federation figures as sections; a custom report as its chart over a
table. Each page says the log's entry it read. The New form saves a
custom report from its title and its definition.

The margins' rows are pinnable, as the collection `reports/margins` with
the fields of its table (`pinnable`), and read through the port by
`rows(port, id)`; no page pins them while the co-op's home is retired.

## Lanterne

The thresholds are a 90 % burn and a 20 % margin, from 1 January 2026. On
25 October, Maison Ferrand's packaging has spent 98 % of its budget with
its last milestone open, and Fondation Terres Vives's report, at 76 % with
45 % of its span to go, would spend about 24 500 € of its 18 000 €; every
other live project is on track. Ferrand's margin is 9 933,92 €: 14 000 €
invoiced less 172 hours at 23,64 €.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts),
`core/sql/analytics.sql`, publishes the thresholds as `report.thresholds`,
which the margins read. It is scoped by `circle`, the circle that owns the threshold.
