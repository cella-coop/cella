+++
title = "account-member-transaction"
updated = 2026-10-24
+++

Members' capital in the books: what a member subscribes on joining and
what they draw on their account, posted. It joins three feats because
both need the chart (account), the member and the journal (transaction);
it builds on `account-member` and `account-transaction`. Declared by
`account`.

## Schema

`account_member_transaction` (`sql/`):

- `subscription`: each member's subscription, their capital account, the
  shares and the entry that posted them.
- `subscribes`, a trigger after a member's status changes from `invited`
  to `active`, in the write that admits them: their capital account opens
  under `1013`, next in the chart, and their shares at the share's value
  post on the verdict date, `4561` (what members owe for capital called)
  debited and their capital credited. Paying it in is money received,
  which posts through a write of its own, not built.
- `draw`: each draw, its member and its entry; `drawn`, each member's
  draws against their limit.

The app role may select and insert; the rules role may select.

## Writes

`account:account:draw` (bounded on the draw limit, `self`), served on a
member's page: the bank pays the member, `455` debited and `512` credited,
on the verdict date, and the draw is recorded as theirs.

## Rules

- `account_member_transaction.draws`, on `account:account:draw`: the draw
  is the actor's own, they are active, their capital account is not
  frozen, their draws with this one stay within their limit, and the
  entry is exactly the draw.

At rung 1 the rule runs under the log's head lock, so two draws of one
member are judged one after the other. At rung 2 a device holds the limit
offline.

## Tests

`ts/_tests/capital.test.ts` (`cella test slice account-member-transaction`):
a capital account is held by a member; an admission subscribes, opening
the account and posting the shares; draws add up against the limit, and a
draw not the actor's own is refused; an exit freezes the capital, for
good.

## Shell

Adds to a member's page their capital in the books, what they drew and
what is left, the entry that subscribed it, and, on their own page, the
draw form, unless their account is frozen.

## Lanterne

The members' capital was carried over on 1 July. Inès subscribes her 20
shares, 1 000 €, when d-2026-012 admits her.
