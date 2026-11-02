+++
title = "account-motion"
updated = 2026-11-02
+++

The statutes' capital terms, a rule the members adopt by motion, and the
motion that adopted it. Declared by `account`.

## Schema

`account_motion` (`sql/`) holds no table: the rule is the policy
register's and the motion feat's, and the terms are the account feat's,
which this graft reads.

- The op `account:terms:adopt` is registered by `motion.register_cite`, so
  `circle-membership-motion`'s `carried` attaches to it: the motion closed
  and passed on its roll. Its label declares `check: 'decided'`.
- It registers by `motion.register_cite` the actions a passed motion
  carries into the books once it admits or ends a membership,
  `account:account:freeze`, `account:capital:subscribe` and
  `account:capital:withdraw`, so each settles only once the motion it
  cites closed and passed. Whether that motion admitted or ended the
  member it names is not checked: no graft joins account, membership and
  motion; the guards of `account-membership` and
  `account-membership-transaction` check that the member was admitted or
  has left.

The app role and the guards role may use the schema.

## Guards

- `account_motion.asks`, on `motion:motion:propose`: each rule the motion
  would adopt that marks a value named `account_…` makes sound capital
  terms (`account.terms_flaw`: all five clauses marked, the share an
  amount, the others whole numbers, an exit repaid within five years),
  and replaces the rule of the terms that govern, if any; and no policy it
  would end is one terms copy, since terms are replaced, never ended.
- `account_motion.adopts`, on `account:terms:adopt`: the cited motion
  adopted the rule the terms copy.

## Reaction

On `motion:policy:adopt`, once the adoption settles: a rule whose values
are named for the account feat is copied into terms by the account
feat's `adopt`, a write of its own signed by whoever signed the adoption
and citing the motion (`handlers/terms.ts`). Any other policy is copied
nothing, and no write is made. The adoption's request names the motion's
action, `n`, so the reaction reads the policy it adopted.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice account-motion`): a
proposal adopts a capital rule only as sound terms, replacing those that
govern, and ends none; copying terms cites the motion that adopted the
rule, never another; the action cites a motion. The e2e scenario
`capital` adopts new terms by motion and refuses a subscription under
them.

## Shell

Adds to the capital terms' page the motion that adopted their rule, and
to a motion's page the terms its rules made. A new motion adopts a
capital rule as any policy, by the motion feat's `policy` action.

## Lanterne

The statutes' capital terms are the founding assembly's rule
`m-2021-001/43`, adopted with the statutes on 1 March 2021.
