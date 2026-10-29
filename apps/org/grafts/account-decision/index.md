+++
title = "account-decision"
updated = 2026-10-29
+++

The statutes' capital terms and the decision of the members that adopts
them. Declared by `account`.

## Schema

`account_decision` (`sql/`):

- the `terms` kind of motion, "Adopt the capital's terms", registered in
  `decision.kind`, so a new decision's form offers it, with the drafted
  capital terms as its options.
- `account_decision.adoption`: the terms and the decision moving to adopt
  them, a view of the motions of the kind. The motion is the decision
  feat's row, so the graft reads it and keeps no copy.

The app role and the rules role may select.

## Rules

- `account_decision.asks`, on `decision:decision:propose`: each motion to
  adopt terms names drafted terms not yet adopted.
- `account_decision.adopts`, on `account:terms:adopt`: the cited decision
  moved to adopt these terms.
- The op is listed in `decision.cites`, so `circle-decision-membership`'s
  `carried` attaches to it: the decision closed and passed on its roll.
  Its label declares `check: 'decided'`.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice account-decision`): a motion
to adopt drafted terms is the adoption it asks for, and a proposal
moving to adopt no such terms is refused; adopting cites a decision that moved to adopt
the terms, never another; the op cites a decision.

## Shell

Adds to the capital terms' page the decisions moving to adopt them, and
the Adopt form; to a decision's page the terms it adopts; and to a new
decision's form the drafted terms it may move to adopt.

## Lanterne

The statutes' capital terms, `st-2021`, were adopted with the statutes in
2021, before the books moved here, so no decision here adopts them.
