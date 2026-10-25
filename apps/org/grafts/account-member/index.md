+++
title = "account-member"
updated = 2026-10-25
+++

Members' capital accounts: who holds each, the value of a share, what each
member may draw, the freeze when a member leaves, and what of a worker's
part of the work share buys shares. Declared by `account`.

## Schema

`account_member` (`sql/`):

- `account_member.terms`: the value of one share, as the statutes set it.
- `account_member.allowance`: what each member may draw on their account,
  granted in advance; the right `account.draw` spends.
- `account_member.held`, a trigger on `account.account`: a capital
  account's holder is a member.
- `account_member.freezes`, a trigger after a member's status changes:
  when it becomes `exited`, their capital accounts are frozen, in the same
  transaction as the write that ended the membership, whichever it is.
  It reacts to the exit wherever it comes from, so it needs no event of
  the member feat's, and no window opens between the exit and the freeze.
- `account_member.capital`: each member's shares at the share's value,
  the account holding them (under `1013`), whether it is frozen, and
  their draw limit.
- `account_member.patronage`: each worker's part of a year's work share
  split as the year's terms say: an associate employed in the co-op (an
  active member whose capital account is not frozen) takes as many whole
  shares at the share's value as the terms' percent of their part buys,
  and the rest is paid; anyone else is paid it all (Code du travail, art.
  R3323-11). Shares so taken are blocked until the first day of the sixth
  month after the year, five years on (art. L3324-10). It reads today's
  members; what an allocation employed when it posted is
  `account-member-transaction`'s record.

Triggers raise SQLSTATE `09000`. The app role and the rules role may
select.

## Writes

None of its own. Opening a member's account on admission posts, so it is
`account-member-transaction`'s.

## Shell

Adds each member's subscribed capital to the members list, and to their
page their capital (subscribed, shares, share value, account, open or
frozen) and their draw limit, and, to the member alone, their work share
statements: each year's part, what it bought in shares and what it paid;
to the chart each capital account's holder; and to a statement its
member by name. Finance reads every statement in the `statements`
collection, whose reads, like every read of the shell, are not yet
restricted.

## Lanterne

A share is 50 €. The ten members hold 260 shares, 13 000 €, each in their
own account from `101301` to `101310`; each may draw up to 500 €.
