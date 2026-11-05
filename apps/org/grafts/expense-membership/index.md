+++
title = "expense-membership"
updated = 2026-11-05
+++

Whose an expense is, by name. The expense feat holds the claimant's
address, as a timesheet entry does; this graft names them, member or
not. Who may claim is every employee's right, `claim-expense`, which
the membership feat's guard checks, and that the claim is the actor's
own `expense.captures`'s, so this graft refuses no claim; it holds an
approval to its mandate's budget ([circles](#circles)). Declared by
`expense`.

## Schema

`expense_membership` (`sql/`): `claim`, each expense with its claimant's
and decider's names, read from person's core, which membership nests
in. The graft writes nothing of the expense feat's. It reads as its reader, so it shows the claims on the expenses its reader reads.

## Circles

A mandate's budget, spent by the expenses its holder approves
(`002-approved.sql`). A budget is a total over a month or a year;
approving an expense spends it. It needs core's mandate and seat and the
expenses the member decided, so it lives here.

- `expense_membership.approved(member, day, per)`: what a member
  approved of expenses over the month or year of a day, in cents.
- `expense_membership.within`, on `expense:expense:approve`: the actor
  holds `approve-expense` on the verdict date through a mandate with no
  budget, or through one whose budget their approvals over its period,
  this one included, stay within. That they hold the power at all, and
  within its limit for the one expense, is the membership feat's guard.

A budget is spent per holder of the mandate: each lead has their own
1 000 € a month. The guard runs under the log's head lock, so two
approvals by one member are judged one after the other. Budgets over
other spending, such as a circle's purchases, come with the writes that
spend them.

In the shell, the graft adds to the acting member's inbox each expense
submitted by someone else that they may approve today, holding
`approve-expense` within its limit for the expense's total, and each
approved one they may reimburse, holding `reimburse-expense`. Whether an
approval stays within their budget is `within`'s, judged when they
approve. In Lanterne, Hugo approves Sofia's 180 € proofs within his
1 000 € for October; a further 960 € plotter repair is beyond it, and
Camille approves it within her 2 000 € limit as gérante.

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
