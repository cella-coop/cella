+++
title = "Project"
updated = 2026-11-15
+++

The co-op's initiatives: a piece of work a client commissioned, or one of
its own, with its milestones and its budget. A project is the container
the work is planned and counted in; its tasks, its time, its client and
the shares of its budget are the grafts'. Its body is its free-form
content, and its threads the comments on it, which `cella scaffold body
project` and `cella scaffold comments project` wrote as the task's are
([threads](../../core/body/index.md#threads)).

## Entities

| Entity | Fields | Notes |
|---|---|---|
| project | `id`, `title`, `circle?`, `summary`, `started`, `due?`, `budget?`, `archived?`, `body?` | `id` is a slug of the title; `budget` in cents; `body` a Loro snapshot of core body's blocks |
| milestone | `project`, `n`, `title`, `due?`, `completed?` | numbered in the order added |
| comment | `id`, `project`, `author`, `parent?`, `text`, `posted`, `resolved?` | numbered by its write's receipt; a reply's `parent` is a root of the same project |
| mention | `comment`, `n`, `person` | each person a comment's text mentions, in order |
| reaction | `comment`, `person`, `emoji` | one of core body's six, while it is on |

`circle` names the circle that runs the project as text, as a motion
does; nothing checks it against the circles. A project is **done** once it
has milestones and every one is complete, and **active** otherwise; an
archived project is hidden from lists, kept for the books and frozen.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `project:project:create` | confluent | `manage-project` | a fact; a taken id is refused, never overwritten |
| `project:milestone:add` | confluent | `manage-project` | appended, numbered under the project's lock |
| `project:milestone:complete` | confluent | `manage-project` | idempotent: the first completion's day stands |
| `project:project:budget` | ordered | `set-budget`, capped by its limit on `amount` | sets the pot the shares spend; ordered against them |
| `project:project:archive` | confluent | `manage-project` | archiving twice changes nothing |
| `project:body:save` | confluent | `discuss` | each save carries the whole merged snapshot |
| `project:comment:post` | confluent | `discuss` | a fact: comments are appended, each numbered by receipt |
| `project:comment:resolve` | confluent | `discuss` | resolving or reopening a root is a register |
| `project:comment:react` | confluent | `discuss` | a toggle per comment, person and emoji |

Setting a budget is ordered because a share spends it: a budget lowered
while a share is granted could leave the shares above it, which the
`membership-project` graft's guard refuses. Every other write commutes.
`002-powers.sql` registers each power in `cella.power`, and the
membership feat checks it; `005-body.sql` and `006-comments.sql`
register the body's and the threads'.

## Powers

| Power | Lanterne |
|---|---|
| `manage-project` | the circle leads and the manager |
| `set-budget` | the leads up to 15 000 €, the manager up to 50 000 € |
| `discuss` | every seat, in every circle |

## Invariants

- a project's id is a slug, unique in the scope;
- an archived project changes no more: no budget, no milestone added or
  completed (`project.stays_archived`, `project.live`, SQLSTATE `09000`);
- a budget is set by the write that names it (`project.budgets`); that it
  covers the shares granted from it is `membership-project`'s guard on the
  same action;
- a body's save names only contributors who discuss in its circle
  (`project.contributed`); a reply answers a root, a mention names a
  person the co-op knows, and only a root is resolved (`project.posts`,
  `project.resolves`); a reaction is one of the six, refused where the
  circle turned reactions off (`project.reacts`). An archived project's
  body is frozen with the rest.

## What it does not know

Project knows no contacts, tasks, members or time. Whom a project is for is
`contact-project`'s; its tasks, `project-task`'s; its time, what it spent
of the budget and its spend at completion, `project-timesheet`'s; the
shares of its budget, `membership-project`'s; its margin and whether it is
watched, the `report` feat's project margins. Quotes and invoicing by milestone are not built.

## Schema

`project` (`core/sql/`): `project.project`, `project.milestone` and
`project.progress`, each project's milestones, how many are complete and
the next open one. The app role may select, insert and update; the guards
role may select. It reads as its reader.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`project.project.circle` is the circle that runs the project; its
milestones are in its circle, which `project.in_its_circle` copies into
each as it is made, as `project.in_its_thread` copies it into each
comment, mention and reaction.
Each write on a project, a milestone, its budget or its archive names
the project's circle in its payload, which core's guard on every power
reads a mandate's scope against, so a lead runs their own circle's
projects alone ([who may act](../../core/grafts/circle-person/index.md#who-may-act)).

## Folds

Each action folds by `core/sql/004-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
a project under the id its entry names, in its circle, with the title,
summary and due day it was started with and the day it started, which
its entry carries; a milestone under the number its entry names, with
its title and due day, the feat's trigger putting it in its project's
circle as it did; a completion on the day its entry names, keeping the
first; a budget set to the amount its entry names; and an archive on
the day its entry names, archiving twice changing nothing. A body's
save, a comment, its resolving and a reaction fold by
`core/sql/005-body.sql` and `core/sql/006-comments.sql`: the body set to
the snapshot its entry carries; the comment under its receipt, with its
mentions, a reply reopening its root; the root resolved on its day or
reopened; the reaction on or off.

## Shell

The `projects` collection opens as a gallery, each card naming its contact,
its milestones done of all, its budget and what its time spent of it (the
root picks these fields, which come from three slices). A project's page,
its header's crumb its id, holds its summary under its title, then
whom it is for (`contact-project`) and its Activity; its circle, its
milestones done of all and the next, its budget and its days are its
properties. The data central to it is in tabs after the first:
Milestones, completing one and adding the next; Budget, its budget, what
is spent and left of it, and its shares (`membership-project`); Tasks
(`project-task`); Time (`project-timesheet`); Expenses
(`expense-project`); and Invoices (`invoice-project`). Archive is the
header's write. Its Overview opens on its body, edited live over core
body's session and saved by each editor's browser, and its threads sit
under its Activity, a mention of a person waiting in their Inbox until
they answer it.

## Import

Projects from a spreadsheet, a CSV with the columns `title` and, if it
has them, `circle`, `summary` and `due`: the importer `projects`, each
line a `project:project:create` as the importing member
([import](../import/index.md)).

## Lanterne

Eleven projects: eight, one for each piece of work its clients
commissioned, and three of the circles' own, for no client:

| Project | Circle | Budget | Milestones |
|---|---|---|---|
| Les Halles Paysannes, online shop | web | 48 000 € | design, build, launch done; care and handover open |
| Ville de Clairval, town website | web | 24 000 € | lots 1 and 2 done |
| Nuvola Énergie, marketing retainer | marketing | 57 600 € | Q3 review done; Q4 review and renewal open |
| Compagnie Mauve Horizon, season posters | brand | 6 200 € | posters and brochure done |
| Vélo Solidaire, brand identity | brand | 3 300 € | concepts, identity and guidelines done |
| Maison Ferrand, packaging | brand | 14 000 € | range concept and print-ready files done; print supervision open |
| Fondation Terres Vives, annual report and microsite | brand | 18 000 € | report design done; microsite open |
| Atelier Ondine, online shop | web | 9 500 € | delivered; archived on 1 September |
| The statutes, revised for 2027 | ag | none | draft amendments done; members' comments and the extraordinary assembly open |
| Pipeline and staffing for 2027 | coordination | none | client review done; rate card and staffing plan open |
| The books move into cella | operations | none | chart and opening balances, pay runs and expenses done; October's close open |

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `project.projects` and `project.milestones` to the analytics shell: each project with its circle, days and budget, and its milestones. Both are scoped by `circle`, the circle that owns the project or the milestone. Each of its views is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
