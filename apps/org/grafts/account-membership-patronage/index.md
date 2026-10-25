+++
title = "account-membership-patronage"
updated = 2026-10-25
+++

What of a worker's part of the work share buys shares: the split of each
part between the associates' capital and cash, whose a statement is, and
the work share's terms read back on a person's page. Declared by
`patronage`.

## Schema

`account_membership_patronage` (`sql/`):

- `split`: each worker's part of a year's work share split as the year's
  terms say: an associate employed in the co-op (an active member whose
  capital account is not frozen) takes as many whole shares at the
  share's value (`account_membership.value`) as the terms' percent of their
  part buys, and the rest is paid; anyone else is paid it all (Code du
  travail, art. R3323-11). Shares so taken are blocked until the first
  day of the sixth month after the year, five years on (art. L3324-10).
  It reads today's members and the share's value on the verdict date;
  what a distribution employed when it posted is
  `account-membership-patronage-transaction`'s record, whose rule checks it
  against this split.

The app role and the rules role may select.

## Tests

`ts/_tests/split.test.ts` (`cella test slice account-membership-patronage`):
an associate's part buys whole shares, blocked until the first of June
five years after the year, and the rest is paid; one whose capital is
frozen, or who is no member, is paid it all.

## Shell

Adds to a statement its member by name, and to a person's page, under
Own and decide, how the work share divides and what of it buys shares,
read back as a sentence from the patronage terms in force.

## Lanterne

Half of each associate's part buys shares of 50 €, as `st-2021` say.
