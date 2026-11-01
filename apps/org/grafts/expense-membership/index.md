+++
title = "expense-membership"
updated = 2026-11-01
+++

Whose an expense is: an active member's. The expense feat holds the
member's address, as a timesheet entry does; this graft checks it and
names them. Declared by `expense`.

## Schema

`expense_membership` (`sql/`): `whose`, a guard on
`expense:expense:capture`: the expense's member is active on the verdict
date, by `membership.active`; `claim`, each expense with its member's
and decider's names. The graft writes nothing of the expense feat's.

## Tests

`ts/_tests/whose.test.ts` (`cella test slice expense-membership`): an
active member claims; one suspended, one only invited and a stranger do
not; the guard is on the capture and no trigger on the expenses.

## Shell

Adds the member's name to each expense, on the board's cards and its page
with who decided it; and to a person's page their expenses.

## Lanterne

Sofia, Thomas, Chloé and Léa have each claimed one in October.
