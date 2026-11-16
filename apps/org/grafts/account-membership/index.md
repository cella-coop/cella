+++
title = "account-membership"
updated = 2026-11-16
+++

Members' capital accounts: who holds each, the value of a share, what each
member may draw, and the freeze when a member leaves. Declared by
`account`.

## Schema

`account_membership` (`sql/`):

- `account_membership.value(day)`: the value of one share on a day, the
  capital clause of the statutes' capital terms governing it in the
  account feat, adopted by the members' motion; NULL before any adopted
  terms state it.
  The graft keeps no share value of its own.
- `account_membership.allowance`: what each member may draw on their account,
  granted in advance; the right `account.draw` spends.
- A capital account's holder is a member: the only write naming one is
  `account-membership-transaction`'s subscription of a member admitted,
  and the fixture check holds the seed's, so no trigger on the account
  feat's table checks it.
- `account_membership.capital`: each member's shares at the share's value on
  the verdict date, the account holding them (under `1013`), whether it
  is frozen, and their draw limit.
- `account_membership.unfrozen(member)`: whether the member holds a
  capital account not yet frozen, run as its owner, since whoever closed
  the motion may read no colleague's capital; the reaction to an exit
  freezes only when it does.

The app role and the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

None of its own. Opening a member's account on admission posts, and so
does moving a departing one's capital to what is owed them, so both are
`account-membership-transaction`'s.

## Reactions

- To `membership:member:exclude`: the account feat's `freeze`
  (`account:account:freeze`), freezing every capital account the member
  holds, an effect citing the exclusion in its transaction, its actor
  whoever signed the exclusion, the member who closed the motion that
  excluded them, and citing that motion. A member who holds no capital account is frozen
  nothing, and no write is made.
- To `membership:member:withdraw`: the account feat's `freezeOwn`
  (`account:own:freeze`), the same freeze as the member's own, signed by
  the member who withdrew and citing no motion.

## Guards

- `account_membership.freezes`, on `account:account:freeze` and
  `account:own:freeze`: the holder
  is a member who has left, so no active member's capital is frozen; on
  `account:own:freeze`, one who left by their own withdrawal (`exit` is
  `withdrew`), so an excluded member's capital is frozen only through
  the motion that excluded them.

## Tests

`ts/_tests/freeze.test.ts` (`cella test slice account-membership`): the
freeze settles for a member who left, every account they hold frozen
and no other, and is refused for an active member; no trigger on
`membership.member` freezes an account, so an exit alone leaves it
open until the freeze. A guard reads the action it judges only while
the notary judges it, so the member's own freeze, which settles for one
who withdrew and is refused for one excluded, before the exclusion's
freeze or after it, is the capital scenario's (`cella test e2e
capital`).

## Reads

A member's draw limit reads as their capital account does: for the member and for capital's readers (`sql/003-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)). `capital` lists each member the same way, filtering its rows by that test, so a page shows a colleague's capital to no one but them and those readers. It reads as its owner, since a share's value is the whole capital's, and is declared so, `audience: shared`, which `cella check feats` holds to that test.

## Shell

Adds each member's subscribed capital to the members list, and to their
page their draw limit and, under Membership, their capital (subscribed, shares, share value, account, open or
frozen); under Joining, the capital an associate
subscribes, at least the statutes' minimum at the share's value, or the
shares they hold; under Membership, what the member owns read back as
sentences from their capital and the statutes' capital terms in force:
their shares, and how capital is repaid to one who leaves; and to the
chart each capital account's holder.

## Lanterne

A share is 50 €, as the capital's terms, the founding rule `m-2021-001/43`, say. The ten members hold 260 shares,
13 000 €, each in their own account from `101301` to `101310`; each may
draw up to 500 €. Paul's `101311` has been frozen since he left.
