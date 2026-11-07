+++
title = "employment-membership"
updated = 2026-11-07
+++

The way from employee to member: a worker's candidacy, the probation
they serve before the assembly rules on their admission and the shares
they pledge, and where each person stands on that way. Declared by the
`employment` feat, it sits at `person`, the lowest node that holds both
feats it joins, and reads the person they share. Profile 1.1's cycle:
hired, a probation, then a member vote and a capital subscription
([users](../../../../../../_corpus/doc/users.md)). After a year's
employment an employee applies to join by their own right
(`apply-membership`): the application, `membership:member:apply`, puts
the motion to admit them to the assembly
([membership-motion](../../../../grafts/membership-motion/index.md)),
and their candidacy opens after it. No one opens another's candidacy,
the employer neither.

## Schema

`employment_membership` (`sql/`):

- `employment_membership.candidacy`: a worker, the probation's first and last
  day, both included, the shares they pledge, and the day it was opened;
  one to a worker, with no foreign key into either feat. A candidacy
  opened on an application runs from the worker's hire to the day before
  they applied.
- `employment_membership.path`: every person who is a worker or a member,
  by name, with their hire, their probation and pledge, their invitation, application, admission and exit,
  and their stage: `employee`, `candidate`, `invited`, `member` (active
  or suspended) or `gone`. It reads as its reader.

The app role may select and insert candidacies; the guards role may
select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../../../_corpus/doc/architecture.md#sql)): the root's,
the assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `employment-membership:candidacy:open` | confluent | `apply-membership` | a fact, once to a worker: two openings of one candidacy cannot both stand, whichever comes first |

`001-employment-membership.sql` registers the power in `cella.power`, and the
membership feat checks it: every employee's right, held to
their own candidacy by `opens`.

## Guards

- `employment_membership.serves`, on `membership:member:apply`: the
  applicant has been employed a year by the verdict date, their hire a
  year or more before it, and is still. The year is this guard's, not a
  value of the policy that grants the right
  ([legal forms](../../../../../../_corpus/doc/forms.md)).
- `employment_membership.opens`, on `employment-membership:candidacy:open`:
  the candidacy is the actor's own, who applied on the verdict date; it
  was opened on that day as the payload names it, from their hire to the
  day before, pledging shares.

## Folds

`employment-membership:candidacy:open` (`employment_membership.fold_open`,
`sql/004-folds.sql`, [folds](../../../../../_corpus/doc/architecture.md#folds)) inserts the
candidacy as its entry carries it, opened on the entry's day.

## Handlers

- `open` (confluent): opens the actor's own candidacy on the verdict
  date, from their hire to the day before, pledging the shares named;
  submits `{ worker, from, to, shares, opened }`. A second is refused
  before the notary by the candidacy's key.
- `opened`, the reaction to `membership:member:apply`: the applicant's
  candidacy, opened by `open`, signed by the applicant as their own
  write by the same right, pledging the shares their application did.

## Tests

`ts/_tests/candidacy.test.ts` (`cella test slice employment-membership`): each
person's stage, one candidacy to a worker, and an application refused
before a year's employment or once the contract has ended. `opens`
reads the actor, which only a write has, so the people scenario proves
it (`cella test e2e people`): a candidacy refused for someone else, and
for one who has not applied.

## Shell

Adds to each person their stage on the way to membership, a hidden column
of the people collection; and to a person's page, their path to
membership, step by step, the day they were hired and the day they
applied. The application itself is offered by membership-motion.

## Lanterne

Everyone hired after the founding was a candidate from their first day,
for six months to a year, pledging 20 shares, and admitted the day after
their probation ended, each proposed by a member. Inès's year ran from 1
September 2025 to 31 August 2026; she was invited on 30 September.
