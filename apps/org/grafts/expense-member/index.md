+++
title = "expense-member"
updated = 2026-10-24
+++

Whose an expense is: an active member's. The expense feat holds the
member's address, as a timesheet entry does; this graft checks it and
names them. Declared by `expense`.

## Schema

`expense_member` (`sql/`): `whose`, a trigger on `expense.expense`, an
expense's member is active (SQLSTATE `09000`); `claim`, each expense with
its member's and decider's names.

## Shell

Adds the member's name to each expense, on the board's cards and its page
with who decided it; and to a member's page their expenses.

## Lanterne

Sofia, Thomas, Chloé and Léa have each claimed one in October.
