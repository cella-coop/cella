+++
title = "account-membership"
updated = 2026-10-25
+++

Members' capital accounts: who holds each, the value of a share, what each
member may draw, and the freeze when a member leaves. Declared by
`account`.

## Schema

`account_membership` (`sql/`):

- `account_membership.value(day)`: the value of one share on a day, the
  capital clause of the statutes' capital terms governing it in the
  account feat, adopted by the members' decision; NULL before any adopted
  terms state it.
  The graft keeps no share value of its own.
- `account_membership.allowance`: what each member may draw on their account,
  granted in advance; the right `account.draw` spends.
- `account_membership.held`, a trigger on `account.account`: a capital
  account's holder is a member.
- `account_membership.freezes`, a trigger after a member's status changes:
  when it becomes `exited`, their capital accounts are frozen, in the same
  transaction as the write that ended the membership, whichever it is.
  It reacts to the exit wherever it comes from, so it needs no event of
  the membership feat's, and no window opens between the exit and the freeze.
- `account_membership.capital`: each member's shares at the share's value on
  the verdict date, the account holding them (under `1013`), whether it
  is frozen, and their draw limit.

Triggers raise SQLSTATE `09000`. The app role and the rules role may
select.

## Writes

None of its own. Opening a member's account on admission posts, and so
does moving a departing one's capital to what is owed them, so both are
`account-membership-transaction`'s.

## Reads

A member's draw limit reads as their capital account does: for the member and for capital's readers (`sql/003-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)). `capital` lists each member the same way, filtering its rows by that test, so a page shows a colleague's capital to no one but them and those readers.

## Shell

Adds each member's subscribed capital to the members list, and to their
page their capital (subscribed, shares, share value, account, open or
frozen) and their draw limit; under Joining, the capital an associate
subscribes, at least the statutes' minimum at the share's value, or the
shares they hold; under Own and decide, what the member owns read back as
sentences from their capital and the statutes' capital terms in force:
their shares, and how capital is repaid to one who leaves; and to the
chart each capital account's holder.

## Lanterne

A share is 50 €, as `st-2021` say. The ten members hold 260 shares,
13 000 €, each in their own account from `101301` to `101310`; each may
draw up to 500 €. Paul's `101311` has been frozen since he left.
