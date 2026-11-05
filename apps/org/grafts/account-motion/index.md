+++
title = "account-motion"
updated = 2026-11-06
+++

The statutes' capital terms, a rule the members adopt by motion, and the
motion that adopted it. Declared by `account`.

## Schema

`account_motion` (`sql/`) holds no table: the rule is the policy
register's and the motion feat's, and the terms are the account feat's,
which this graft reads.

- The op `account:terms:adopt` is registered by `motion.register_cite`, so
  `membership-motion`'s `carried` attaches to it: the motion closed
  and passed on its roll, and the motion feat's `mandated`, that its
  circle holds `adopt-policy`, the power it registers with it.
- It registers by `motion.register_cite` the actions a passed motion
  carries into the books once it admits or excludes a member,
  `account:account:freeze`, `account:capital:subscribe` and
  `account:capital:withdraw`, with the powers their motion's own action
  needs, `exclude-member`, `admit-member` and `exclude-member`, so each
  settles only once the motion it cites closed and passed, and its
  circle holds the power; `account_motion.admits` and
  `account_motion.excludes` hold each to the member the motion admitted
  or excluded. That the member is active or
  has left is the guards' of `account-membership` and
  `account-membership-transaction`.

The app role and the guards role may use the schema.

## Guards

- `account_motion.asks`, on `motion:motion:propose`: each rule the motion
  would adopt that marks a value named `account_…` makes sound capital
  terms (`account.terms_flaw`: all five clauses marked, the share an
  amount, the others whole numbers, an exit repaid within five years),
  and replaces the rule of the latest terms, those whose rule applies
  latest, if any, as `motion_patronage.asks` does: while terms adopted
  to apply on 1 January wait, a rule proposed in November replaces
  those, never the terms that govern today, and applies on or after
  their day, since the motion feat refuses to replace a policy not in
  force the day the new one applies. Its reason names the terms to
  replace and the day they apply, so the member who proposes it names
  them and proposes again; and no policy it would end is one terms
  copy, since terms are replaced, never ended. At the close the motion
  feat's `motion.adopts` judges the replacement again, since another
  motion may have replaced the same terms while this one was open.
- `account_motion.subscribes`, on `motion:motion:propose` and
  `membership:member:apply`, registered by the motion feat's
  `motion.register_ask_guard`, which attaches it to every action that
  puts a motion: each admission the motion asks, read from
  the motion feat's `motion.action`, is one whose subscription would
  settle if the motion closed the day it is proposed
  (`account.subscribe_flaw` for its shares on that day). A motion's terms
  are checked as early as they can be: a proposal or an application
  asking 10 shares under a minimum of 20 is refused at once, its reason
  saying the statutes' minimum, the rule that sets it and the shares
  asked, so the member who proposes it corrects the shares and proposes
  again; one dated into a closed month is refused saying the month and
  the first open one. The close checks the same terms again, by the
  subscription's own guard, since a month may close or the terms change
  while the motion is open; refused then, the subscription forgoes the
  admission with it ([membership-motion](../membership-motion/index.md)).
- `account_motion.adopts`, on `account:terms:adopt`: the cited motion
  adopted the rule the terms copy.
- `account_motion.admits`, on `account:capital:subscribe`: the cited
  motion carries an action admitting the member who subscribes, read
  from the motion feat's `motion.action`, its kind and its `member`;
  one that admitted someone else is refused, `<motion> does not admit
  <member>`.
- `account_motion.excludes`, on `account:capital:withdraw` and
  `account:account:freeze`: the cited motion carries an action
  excluding the member whose capital is withdrawn, or the `holder`
  whose accounts are frozen; one that excluded someone else is refused,
  `<motion> does not exclude <member>`.

## Reaction

On `motion:policy:adopt`, in the adoption's transaction: a rule whose values
are named for the account feat is copied into terms by the account
feat's `adopt`, an effect citing the adoption, its actor whoever signed it,
and citing the motion (`handlers/terms.ts`). Any other policy is copied
nothing, and no write is made. The adoption's request names the motion's
action, `n`, so the reaction reads the policy it adopted.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice account-motion`): a
proposal adopts a capital rule only as sound terms, replacing the latest
terms, and ends none; while terms still to apply wait, a rule naming
those that govern is refused naming the waiting ones, and one naming
those, applying from their day or later, is accepted, the capital
governed by each on its days; copying terms cites the motion that
adopted the rule, never another; the action cites a motion; a subscription, a
withdrawal or a freeze cites a motion that admitted or excluded its own
member, never another's. The e2e scenario
`capital` adopts new terms by motion and refuses a subscription under
them.

## Shell

Adds to the capital terms' page the motion that adopted their rule, and
to a motion's page the terms its rules made. A new motion adopts a
capital rule as any policy, by the motion feat's `policy` action.

## Lanterne

The statutes' capital terms are the founding assembly's rule
`m-2021-001/43`, adopted with the statutes on 1 March 2021.
