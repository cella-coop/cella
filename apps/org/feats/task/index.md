+++
title = "Task"
updated = 2026-11-15
+++

Assignable work items: the atomic unit of the co-op's work. A task stands
alone or sits in a project; who does it and which project it is in are
the grafts'.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| task | `id`, `title`, `status`, `priority`, `due?`, `created`, `completed?`, `body?` | `id` is `t-<n>`, numbered by the server; `body` is its free-form content, a Loro snapshot ([body](../../core/body/index.md)) |
| comment | `id`, `task`, `author`, `parent?`, `text`, `mentions[]`, `posted`, `resolved?` | `task` a foreign key into `task.task`, `author` into `person.person`; `parent` a root comment, never a reply, so replies are flat, one level; `resolved` only on a root |
| reaction | `comment`, `person`, `emoji` | one row per comment, person and emoji of core body's fixed set; toggled |

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
| `task:body:save` | confluent | `discuss` | an editor's save of the merged body, signed by its device: each save carries the whole snapshot, so the later receipt holds every edit before it |
| `task:comment:post` | confluent | `discuss` | a fact: comments are appended, each numbered by receipt |
| `task:comment:resolve` | confluent | `discuss` | resolving a root or reopening it is a register: the last writer wins |
| `task:comment:react` | confluent | `discuss` | a toggle: one reaction per comment, person and emoji, the last writer wins |

Each field is its own register: a move and a change of priority both
stand, and two moves of one task resolve to the later receipt. A move
sets any status short of done, and moving a done task back reopens it;
done is a completion, which records its day and keeps the first one.
A body is saved by an editor's browser, signed by its device, at a pause
and on leaving the body: it posts `task:body:save` with the merged
snapshot, and its entry names who contributed since the last save, as
core body's session tells it, each holding `discuss` in the task's
circle, which the feat's guard checks of each at the save as the
session does at every update ([the live
session](../../core/body/index.md#the-live-session)).

A comment is a root or a reply to one: a reply to a reply is refused,
naming the root to reply to. Only a root is resolved, which folds its
replies away and reopens with a new reply. A comment's text is free
text, the author's to keep personal data out of
([trust](../../../../_corpus/doc/trust.md#personal-data)); a mention
is a structured reference to a core person, `@[address]` in the text
and a row of `task.mention` for each person it names, in the order
given: the person's address, the pseudonym every entry names them by,
never their name, which the thread draws as it stands, so erasing the
person's name erases what it reads. A reaction is refused where the
task's circle has `reactions` off, read by `circle.setting_of`, the
refusal naming the circle and the rule that turned it off.
Nothing a task write changes is read by an ordered write's guard, so none
waits. `002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Powers

| Power | Lanterne |
|---|---|
| `edit-task` | every member, through the `member` role's mandate |
| `discuss` | the participants of the task's circle, every seat in it ([circle](../../core/circle/index.md#the-participant-role)) |

## Invariants

- a task is done exactly when it has its completion day;
- its status and priority are among the known ones.

That a task's project exists is `project-task`'s; that its assignee is an
active member, `membership-task`'s.

## Schema

`task` (`core/sql/`): `task.task` and `task.number`, the sequence its ids
take. The app role may select, insert and update; the guards role may
select. A task's `body` is a Loro snapshot with a canonical form, which
its column checks by `cella.document_canonical`, so bytes with none are
refused. A save's guard, `task.contributed` (`core/sql/006-body.sql`),
asks circle-person's `may` whether each contributor its entry names
holds `discuss` in the circle the entry names, which its handler read
from the task, and says who does not.

`task.comment` holds each comment under its receipt, in its task's
circle, copied as it is made; `task.mention` each person a comment's
text names, `(comment, n, person)`, `n` its place in the text. The app
role may select and insert both, and update a comment's `resolved`.
`core/sql/007-comment.sql` holds their guards: `task.posts` refuses a
post that is not the actor's own or names otherwise than its row, and
a reply to a reply, naming the root to reply to, and a reply's parent
is a comment of the same task by its key; `task.resolves` refuses
resolving a reply, naming its
root. Who may post or resolve is the `discuss` power's, in the circle
the payload names, which the handler read from the task.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

A task's title may name a person, so it is personal data of class
`profile`, erased when asked, its subject the task, since no column
names whose it is (`core/sql/004-personal.sql`): a write commits to it
in the log, the vault keeps it, and the analytical contract shows it
commented personal.

## Folds

Each action folds by `core/sql/005-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
a task created under the id its entry names, its title as its
commitment, its priority, due day and status as its entry carries them,
on the entry's day; a move to the status its entry names, reopening a
done task; a completion on the entry's day, keeping the first; a
body's save, setting `body` to the snapshot its entry carries; a
comment's post, under the receipt its entry names, by its actor on its
day, with the mentions it names, a reply reopening its root; and a
resolve, setting the root resolved on the entry's day or reopening it.

## Shell

The `tasks` collection opens as a board grouped by status, its columns
backlog, todo, doing and done, each card naming its assignee, project,
priority and due day. Dragging a card into backlog, todo or doing is the
`move`, into done the `complete`, posted with the column entered and
signed as the acting member; a refused move leaves the card where it
was. The board also groups by priority, assignee or project. A task's
page, its header's crumb its id, moves and completes it in its header;
its assignee and project are set in its Details, and its main area
opens on its body in core body's editor over the live session, read-only
for one who may read the task and not discuss it. Under it, past a
hairline, Activity: the task's events from the log and its threads, oldest
first, in core body's `Thread`, with the box that posts a comment and
its mention picker; one who may not discuss the task reads the threads
and has no box. A mention of a person is a row of their Inbox until
they reply in its thread or it is resolved ([the
inbox](../../core/person/index.md#shell)). It has no tab of its own.

## Lanterne

Thirty-seven tasks across the projects and the co-op's own work, each
its circle's, its project's where it is filed in one, so each circle's
lens shows its own, and most given to a member of that circle: the Halles shop's
launch checklist and its care (Yusuf, Thomas, Amina, Léa), Ferrand's
proofs and press check (Hugo), Terres Vives's microsite (Léa, Amina),
Nuvola's newsletter and social calendar (Chloé, Malik), Julien's
October close, the amendments the assembly drafts (Camille, Chloé) and
coordination's staffing plan (Yusuf). The payment provider's go-live
checklist, `t-1`, has a body, the steps before go-live and on the day,
which the founding carries in with the task, as it carries a
document's versions, so a seeded Lanterne's log is its founding alone.
It carries in its thread too: Yusuf asks whether the payout account is
checked, and Amina replies, mentioning him, so the mention waits in
Yusuf's Inbox until he answers.

## Tests

- Slice tests (`core/ts/_tests/`): the tasks' registers and the folds,
  a body's save setting the column to its entry's snapshot, a body with
  no canonical form refused, and a save naming a contributor with no
  `discuss` in the task's circle refused, naming them; a comment's post
  and resolve folded, a reply reopening its root; a reply to a reply,
  resolving a reply, and a post naming otherwise than its row refused,
  naming the root; and a mention reading its person's name, and erased
  once their name is.
- In Chromium, Firefox and WebKit (`ts/_e2e/thread.test.ts`): Léa posts
  on a task of Web's, mentioning Thomas through the picker, and the
  mention waits in Thomas's Inbox; Thomas replies and it leaves; Léa
  resolves the thread, which folds its replies away; a reply to a reply
  is refused, naming the root; and the founding's thread on `t-1` waits
  in Yusuf's Inbox; screenshots light and dark. No one at Lanterne reads
  a task without discussing it, since its participants discuss in every
  circle, so the box withheld from such a reader is not walked.
- In Chromium, Firefox and WebKit (`ts/_e2e/body.test.ts`): Léa and
  Thomas edit one of Web's tasks in two tabs, each seeing the other's
  edits; each browser saves at its pause, signed by its device, the
  entries naming both; a reload opens on the save, and Camille, seated
  in other circles, opens it on the save too, since Lanterne's
  participants discuss in every circle; screenshots light and dark.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `task.tasks` to the analytics shell: each task, its status, priority and days. It is scoped by `circle`, the circle that owns the task. Its view is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
