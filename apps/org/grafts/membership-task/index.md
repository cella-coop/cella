+++
title = "membership-task"
updated = 2026-11-15
+++

Who does a task. A task without an assignee is unassigned, not invalid.
Declared by `task`.

## Schema

`membership_task` (`sql/`): `membership_task.assignment`, a task and its assignee,
by id and address, with no foreign key into either feat. A trigger refuses
a task that does not exist or an assignee who is not an active member
(SQLSTATE `09000`). The app role may select, insert, update and delete;
the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `membership-task:task:assign` | confluent | `edit-task` | the assignee is a register: the last writer wins; none unassigns |

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Folds

An assignment folds by `membership_task.fold_assign` (`sql/004-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)):
the task given to the member the entry names, or taken from whoever had
it where it names none. The graft's trigger judges the assignee again on
the entry's day, as it did when it was written.

## Invariants

- an assignment's task exists, and its assignee is an active member on the verdict date, as
  `membership.active` says.

A member who is suspended or exits keeps the tasks given to them until
someone reassigns them; nothing reassigns them by itself.

## Shell

Adds to each task its assignee's name, a field the tasks' board shows on
its cards and may group by; to a task's Details, the assignee and the form
that gives it to someone; to a person's page, in a Tasks tab, the tasks they do that
are not done.

## Lanterne

Each task goes to a member of the circle that runs its project, Julien's
to the October close and the overdue Mauve invoice.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `membership_task.assignments` to the analytics shell: who each task is assigned to. It is scoped by `circle`, the circle that owns each row. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
