+++
title = "project-task"
updated = 2026-11-01
+++

Which project a task is in, and which of its milestones. A task in no
project stands alone, which is not invalid. Declared by `task`.

## Schema

`project_task` (`sql/`):

- `project_task.filing`: a task, its project and, if any, the number of
  one of its milestones, with no foreign key into either feat. A trigger
  refuses a task or a project that does not exist, a project that is
  archived, or a milestone the project does not have (SQLSTATE `09000`).
- `project_task.count`: each project's tasks and how many are done.

The app role may select, insert and update; the guards role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `project-task:task:file` | confluent | `edit-task` | the filing is a register: the last writer wins; a task is in one project |
| `task:task:create`, on a project's page | confluent | `edit-task` | the task feat's creation and the filing, in one transaction under its verdict |

`002-powers.sql` registers the power in `cella.power`, and the
`circle-membership` graft checks it.

## Invariants

- a filing's task and project exist, the project is not archived, and its
  milestone is one of the project's.

## Shell

Adds to each task its project's title, a field the tasks' board shows on
its cards and may group by; to a task's page, its project and milestone
and the form that files it. On a project's page it adds the Tasks tab:
the project's tasks, open ones first, and a new task already in the
project, under one of its open milestones if chosen.

## Import

Tasks from a spreadsheet or Asana's task export (`Name`, `Projects`,
`Due Date`, `Completed At`): the importer `tasks`, each created in the
project it names by title or id, or in none. A task done before the
switch, or in a project the co-op does not hold, is refused
([import](../../feats/import/index.md)).

## Lanterne

Twenty-seven of the thirty-three tasks are in a project, most under a
milestone: the Halles shop's launch checklist under Launch, its training
and handover under Care and handover. The co-op's own tasks, such as
closing October's books, are in none.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `project_task.filings` to the analytics shell: which project, and which of its milestones, each task is filed under.
