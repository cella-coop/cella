+++
title = "patronage-transaction"
updated = 2026-10-25
+++

A year's distribution in the books: distributing an approved split posts
it from the year's result to where each share goes, in one entry, and the
legal reserve takes its 15 % until it reaches the highest capital.
Declared by `patronage`.

## Schema

`patronage_transaction` (`sql/`):

- `patronage_transaction.distribution`: the entry each distribution
  posted; `lines(distribution)`, its split as lines: the year's result,
  `120`, debited by the surplus, and each share credited to where it goes
  in a French SCOP's chart, the work share to `424`, what the workers are
  owed, the legal reserve to `1061`, the development fund, an indivisible
  reserve, to `1068`, and the interest on capital to `457`.
- `capital(day)`, the members' capital, every account of class `101`, on
  a day, and `highest()`, the most it ever reached on a day the journal
  moved it.

The app role may select and insert a distribution's entry; the rules
role may select.

## Rules

- `patronage_transaction.posted`, on `patronage:distribution:distribute`:
  the distribution posted one entry, dated the day it was distributed,
  which posts every line of its split. A write posts one entry, so what a
  graft above posts in the same write, the work share employed in shares,
  is lines of that entry: they balance among themselves and touch not the
  year's result, and `account-membership-patronage-transaction` checks they
  are exactly its own and that nothing else is posted.
- `patronage_transaction.reserves`, on `patronage:distribution:approve`:
  at least 15 % of the surplus goes to the legal reserve until the
  reserve, read from the journal, reaches the highest amount the capital
  ever reached (loi n° 78-763, art. 33, 1°).

## Handlers

`distribute` (ordered, `distribute-surplus`) wraps the patronage feat's
`distributing`: the distribution marked, then its entry through the
transaction feat's `record`, linked here, after which the grafts above
add their lines to it.

## Tests

`ts/_tests/distribution.test.ts` (`cella test slice
patronage-transaction`): a distribution's lines; its entry posts the
split, and is refused when it misses a line or posts beside it what does
not balance away from the result; the legal reserve's 15 % is owed while
it is under the highest capital, and no longer once it reaches it.

## Shell

Adds to a distribution's page the entry it posted, and the Distribute
button once the split is approved.

## Lanterne

Distributing 2025 posts 61 400 € out of `120`: 27 630 € to `424`,
9 210 € to the legal reserve, 15 350 € to the development fund and
9 210 € to `457`.
