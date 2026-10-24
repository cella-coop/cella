+++
title = "account-decision"
updated = 2026-10-24
+++

A surplus allocation and the decision of the members that approved its
split. Declared by `account`.

## Schema

`account_decision` (`sql/`):

- `account_decision.approval`: the allocation and the decision approving
  it, each by id, with no foreign key into either feat.

The app role may select and insert; the rules role may select.

## Rules

- `account_decision.approves`, on `account:surplus:allocate`: the cited
  decision is the one approving this allocation.
- The op is listed in `decision.cites`, so `circle-decision-member`'s
  `carried` attaches to it: the decision closed and passed on its roll.
  The write's label declares `check: 'decided'`.

## Shell

Adds to an allocation's page the decision approving it, and the Allocate
form, which posts `account-transaction`'s write citing that decision; and
to a decision's page the allocation it approves.

## Lanterne

d-2026-006, a majority of the assembly closed on 20 June 2026, approves
`al-2025`, the 2025 split.
