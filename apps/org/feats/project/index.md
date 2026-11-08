+++
title = "Project"
updated = 2026-11-08
+++

The co-op's initiatives: a piece of work a client commissioned, or one of
its own, with its milestones and its budget. A project is the container
the work is planned and counted in; its tasks, its time, its client and
the shares of its budget are the grafts'.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| project | `id`, `title`, `circle?`, `summary`, `started`, `due?`, `budget?`, `archived?` | `id` is a slug of the title; `budget` in cents |
| milestone | `project`, `n`, `title`, `due?`, `completed?` | numbered in the order added |

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

Setting a budget is ordered because a share spends it: a budget lowered
while a share is granted could leave the shares above it, which the
`membership-project` graft's guard refuses. Every other write commutes.
`002-powers.sql` registers each power in `cella.power`, and the
membership feat checks it.

## Powers

| Power | Lanterne |
|---|---|
| `manage-project` | the circle leads and the manager |
| `set-budget` | the leads up to 15 000 €, the manager up to 50 000 € |

## Invariants

- a project's id is a slug, unique in the scope;
- an archived project changes no more: no budget, no milestone added or
  completed (`project.stays_archived`, `project.live`, SQLSTATE `09000`);
- a budget is set by the write that names it (`project.budgets`); that it
  covers the shares granted from it is `membership-project`'s guard on the
  same action.

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
each as it is made.
Each write on a project, a milestone, its budget or its archive names
the project's circle in its payload, which the membership feat's guard
reads a mandate's scope against, so a lead runs their own circle's
projects alone ([membership](../person/feats/membership/index.md#seats)).

## Folds

Each action folds by `core/sql/004-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
a project under the id its entry names, in its circle, with the title,
summary and due day it was started with and the day it started, which
its entry carries; a milestone under the number its entry names, with
its title and due day, the feat's trigger putting it in its project's
circle as it did; a completion on the day its entry names, keeping the
first; a budget set to the amount its entry names; and an archive on
the day its entry names, archiving twice changing nothing.

## Shell

The `projects` collection opens as a gallery, each card naming its contact,
its milestones done of all, its budget and what its time spent of it (the
root picks these fields, which come from three slices). A project's page
has three tabs: Overview, with its summary, its milestones (completing
one, adding the next), its budget and its shares; Tasks
(`project-task`); and Time (`project-timesheet`). The two are tabs because
each is a list long enough to crowd the overview. Archive is the header's
write.

## Import

Projects from a spreadsheet, a CSV with the columns `title` and, if it
has them, `circle`, `summary` and `due`: the importer `projects`, each
line a `project:project:create` as the importing member
([import](../import/index.md)).

## Lanterne

Eight projects, one for each piece of work its clients commissioned:

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

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `project.projects` and `project.milestones` to the analytics shell: each project with its circle, days and budget, and its milestones. Both are scoped by `circle`, the circle that owns the project or the milestone.
