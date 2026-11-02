+++
title = "expense-membership"
updated = 2026-11-02
+++

Whose an expense is, by name. The expense feat holds the claimant's
address, as a timesheet entry does; this graft names them, member or
not. Who may claim is every employee's right, `claim-expense`, which
`circle-membership`'s guard checks, and that the claim is the actor's
own `expense.captures`'s, so this graft refuses nothing. Declared by
`expense`.

## Schema

`expense_membership` (`sql/`): `claim`, each expense with its claimant's
and decider's names, read from person's core, which membership nests
in. The graft writes nothing of the expense feat's.

## Tests

`ts/_tests/claim.test.ts` (`cella test slice expense-membership`): a
claim is named for its claimant, an invited worker's as a member's, and
for who decided it; no guard of this graft's is on the capture, and no
trigger on the expenses.

## Shell

Adds the claimant's name to each expense, on the board's cards and its
page with who decided it; and to a person's page their expenses.

## Lanterne

Sofia, Thomas, Chloé and Léa have each claimed one in October; in the
people scenario Inès, employed and no member, claims one by her right.
