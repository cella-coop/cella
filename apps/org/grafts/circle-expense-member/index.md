+++
title = "circle-expense-member"
updated = 2026-10-24
+++

A mandate's budget, spent by the expenses its holder approves. A budget
is a total over a month or a year; approving an expense spends it. It
needs the mandate (circle), the seat (circle-member's) and the expenses
the member decided (expense), so it joins all three and builds on
`circle-member`. Declared by `expense`.

## Schema

`circle_expense_member` (`sql/`): `approved(member, day, per)`, what a
member approved of expenses over the month or year of a day, in cents.

## Rules

- `circle_expense_member.within`, on `expense:expense:approve`: the actor
  holds `approve-expense` on the verdict date through a mandate with no
  budget, or through one whose budget their approvals over its period,
  this one included, stay within. That they hold the power at all, and
  within its limit for the one expense, is `circle-member`'s rule.

A budget is spent per holder of the mandate: each lead has their own
1 000 € a month. The rule runs under the log's head lock, so two
approvals by one member are judged one after the other. Budgets over
other spending, such as a circle's purchases, come with the writes that
spend them.

## Lanterne

Hugo approves Sofia's 180 € proofs within his 1 000 € for October; a
further 960 € plotter repair is beyond it, and Camille approves it within
her 2 000 € limit as gérante.
