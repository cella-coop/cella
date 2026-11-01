+++
title = "account-motion"
updated = 2026-11-01
+++

The statutes' capital terms and the motion of the members that adopts
them. Declared by `account`.

## Schema

`account_motion` (`sql/`):

- the `terms` kind of action, "Adopt the capital's terms", registered in
  `motion.carries`, so a new motion's form offers it, with the drafted
  capital terms as its options.
- `account_motion.adoption`: the terms and the motion moving to adopt
  them, a view of the actions of the kind. The action is the motion
  feat's row, so the graft reads it and keeps no copy.

The app role and the guards role may select.

## Guards

- `account_motion.asks`, on `motion:motion:propose`: each action to
  adopt terms names drafted terms not yet adopted.
- `account_motion.adopts`, on `account:terms:adopt`: the cited motion
  moved to adopt these terms.
- The op is listed in `motion.cites`, so `circle-membership-motion`'s
  `carried` attaches to it: the motion closed and passed on its roll.
  Its label declares `check: 'decided'`.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice account-motion`): an action
to adopt drafted terms is the adoption it asks for, and a proposal
moving to adopt no such terms is refused; adopting cites a motion that moved to adopt
the terms, never another; the action cites a motion.

## Shell

Adds to the capital terms' page the motions moving to adopt them, and
the Adopt form; to a motion's page the terms it adopts; and to a new
motion's form the drafted terms it may move to adopt.

## Lanterne

The statutes' capital terms, `st-2021`, were adopted with the statutes in
2021, before the books moved here, so no motion here adopts them.
