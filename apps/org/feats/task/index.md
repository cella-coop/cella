+++
title = "Task"
updated = 2026-11-05
+++

Assignable work items: the atomic unit of the co-op's work. A task stands
alone or sits in a project; who does it and which project it is in are
the grafts'.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| task | `id`, `title`, `status`, `priority`, `due?`, `created`, `completed?` | `id` is `t-<n>`, numbered by the server |

| Status | Meaning |
|---|---|
| backlog | someday, not planned |
| todo | planned, not started |
| doing | under way |
| done | completed, on its day |

Priorities are `urgent`, `high`, `normal` and `low`. Seedling's
`cancelled` and subtasks are left out: a task no one will do goes back to
the backlog, and subtasks wait for a need.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `task:task:create` | confluent | `edit-task` | a fact; numbered by the server until rung 2 gives devices ids of their own |
| `task:task:move` | confluent | `edit-task` | the status is a register: the last writer wins |
| `task:task:complete` | confluent | `edit-task` | sets the status done with its day; the last writer wins |

Each field is its own register: a move and a change of priority both
stand, and two moves of one task resolve to the later receipt. A move
sets any status short of done, and moving a done task back reopens it;
done is a completion, which records its day and keeps the first one.
Nothing a task write changes is read by an ordered write's guard, so none
waits. `002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Powers

| Power | Lanterne |
|---|---|
| `edit-task` | every member, through the `member` role's mandate |

## Invariants

- a task is done exactly when it has its completion day;
- its status and priority are among the known ones.

That a task's project exists is `project-task`'s; that its assignee is an
active member, `membership-task`'s.

## Schema

`task` (`core/sql/`): `task.task` and `task.number`, the sequence its ids
take. The app role may select, insert and update; the guards role may
select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Shell

The `tasks` collection opens as a board grouped by status, its columns
backlog, todo, doing and done, each card naming its assignee, project,
priority and due day. Dragging a card into backlog, todo or doing is the
`move`, into done the `complete`, posted with the column entered and
signed as the acting member; a refused move leaves the card where it
was. The board also groups by priority, assignee or project. A task's
page moves and completes it in its header; its assignee and project are
set in its content.

## Lanterne

Thirty-three tasks across the projects and the co-op's own work, each
given to a member of the circle that runs its project: the Halles shop's
launch checklist and its care (Yusuf, Thomas, Amina, Léa), Ferrand's
proofs and press check (Hugo), Terres Vives's microsite (Léa, Amina),
Nuvola's newsletter and social calendar (Chloé, Malik), and Julien's
October close.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `task.tasks` to the analytics shell: each task, its status, priority and days. It is scoped by `circle`, the circle that owns the task.
