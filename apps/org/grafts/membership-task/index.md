+++
title = "membership-task"
updated = 2026-10-25
+++

Who does a task. A task without an assignee is unassigned, not invalid.
Declared by `task`.

## Schema

`membership_task` (`sql/`): `membership_task.assignment`, a task and its assignee,
by id and address, with no foreign key into either feat. A trigger refuses
a task that does not exist or an assignee who is not an active member
(SQLSTATE `09000`). The app role may select, insert, update and delete;
the rules role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `membership-task:task:assign` | confluent | `edit-task` | the assignee is a register: the last writer wins; none unassigns |

`002-powers.sql` registers the power in `cella.power`, and the
`circle-membership` graft checks it.

## Invariants

- an assignment's task exists, and its assignee is an active member.

A member who is suspended or exits keeps the tasks given to them until
someone reassigns them; nothing reassigns them by itself.

## Shell

Adds to each task its assignee's name, a field the tasks' board shows on
its cards and may group by; to a task's page, the assignee and the form
that gives it to someone; to a person's page, the tasks they do that are
not done.

## Lanterne

Each task goes to a member of the circle that runs its project, Julien's
to the October close and the overdue Mauve invoice.
