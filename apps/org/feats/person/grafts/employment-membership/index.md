+++
title = "employment-membership"
updated = 2026-10-25
+++

The way from employee to member: a worker's candidacy, the probation
they serve before the assembly may admit them and the shares they pledge,
and where each person stands on that way. Declared by the `employment`
feat, it sits at `person`, the lowest node that holds both feats it
joins, and reads the person they share. Profile 1.1's cycle: hired, a probation of six to twelve months, then a
member vote and a capital subscription ([users](../../../../../../_corpus/doc/users.md)).

## Schema

`employment_membership` (`sql/`):

- `employment_membership.candidacy`: a worker, the probation's first and last
  day, both included, the shares they pledge, and the day it was opened;
  one to a worker, with no foreign key into either feat.
- `employment_membership.path`: every person who is a worker or a member,
  by name, with their hire, their probation and pledge, their invitation, admission and exit,
  and their stage: `employee`, `candidate`, `invited`, `member` (active
  or suspended) or `gone`.

The app role may select and insert candidacies; the rules role may
select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `employment-membership:candidacy:open` | confluent | `hire-worker` | a fact, once to a worker: two openings of one candidacy cannot both stand, whichever comes first |

`001-employment-membership.sql` registers the power in `cella.power`, and the
`circle-membership` graft checks it.

## Rules

- `employment_membership.opens`, on `employment-membership:candidacy:open`: the
  candidacy is a worker's who is no member yet, or only invited; it was
  opened on the verdict date as the payload names it; its probation
  starts no earlier than the hire and ends no later than the contract.

## Tests

`ts/_tests/candidacy.test.ts` (`cella test slice employment-membership`): each
person's stage, and a candidacy refused for a member, outside the
employment or twice.

## Shell

Adds to each person their stage on the way to membership, a hidden column
of the people collection; to a person's page, their path to membership,
step by step, and the day they were hired; and on an employee's page,
opening their candidacy.

## Lanterne

Everyone hired after the founding was a candidate from their first day,
for six months to a year, pledging 20 shares, and admitted the day after
their probation ended. Inès's year ran from 1 September 2025 to 31
August 2026; she was invited on 30 September.
