+++
title = "motion-patronage"
updated = 2026-11-04
+++

A year's distribution and the motion of the assembly that approves its
split; the work share's terms, a rule the members adopt by motion, and
the motion that adopted it.
Declared by `patronage`.

## Schema

`motion_patronage` (`sql/`):

- `motion_patronage.approval`: each distribution and the motions
  moving to approve it, a view of the actions of the `distribution` kind.
  A draft moved again, after a motion that failed, has both; approving
  it cites the one that passed.
- the `distribution` kind of action, "Approve a year's distribution",
  registered by `motion.register_carries`, with the drafted distributions as its
  options (`distributions`).
- the work share's terms are no action of their own: a rule whose values
  are named `patronage_…` is adopted as any policy, by the motion feat's
  `policy` action, and copied into terms by the reaction below.

The actions are the motion feat's rows, so the graft reads them and
keeps no copy. The app role and the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `motion_patronage.approves`, on `patronage:distribution:approve`, and on
  `patronage:distribution:distribute` and `patronage:part:employ`, which
  follow the approval citing its motion: the cited motion moved to
  approve this distribution.
- `motion_patronage.asks`, on `motion:motion:propose`: each rule the
  motion would adopt that marks a value named `patronage_…` makes sound
  terms (`patronage.terms_flaw`: the five shares marked, each at most all,
  the weights adding up to 100), applies from the first day of a fiscal
  year, and replaces the rule of the latest terms, if any; and no policy
  it would end is one terms copy, since terms are replaced, never ended.
- `motion_patronage.asks_to_approve`, on `motion:motion:propose`:
  each action to approve a distribution names a draft not yet approved.
- `motion_patronage.adopts`, on `patronage:terms:adopt`: the cited
  motion adopted the rule the terms copy.
- The four actions are registered by `motion.register_cite` with their powers, so `membership-motion`'s
  `carried` attaches to them: the motion closed and passed on its roll.
  Their labels name the powers they register with them, collective
  mandates of the motion's circle: `adopt-policy` for the terms adopted,
  `approve-distribution` for approving, the
  distribution and the credits of shares that follow an approval.

## Reaction

On `motion:policy:adopt`, once the adoption settles: a rule whose values
are named for the patronage feat is copied into terms by the patronage
feat's `adopt`, a write of its own signed by whoever signed the adoption
and citing the motion (`handlers/terms.ts`). Any other policy is copied
nothing, and no write is made.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice motion-patronage`): a
proposal adopts a work share rule only as sound terms from the first of
a year, replacing the latest, and ends none; copying terms cites the
motion that adopted the rule, never another. `ts/_tests/approval.test.ts`:
approving cites the motion that moved to approve the distribution, never
another; a draft moved again is approved by either
motion moving to, and a proposal moving to approve no draft is refused;
the four actions cite a motion, and the distribution and the credits that
follow an approval are judged by the motion it cites.

## Shell

Adds to a distribution's page the motion approving it, and the Approve
form, which posts the patronage feat's write citing that motion; to the
patronage terms' page the motion that adopted their rule; to a motion's
page the distribution it approves and the terms its rules made; and to a
new motion's form the drafted distributions it may move to approve.

## Lanterne

m-2026-006, a majority of the assembly closed on 20 June 2026, approves
the 2025 distribution by its action; a later year's is
moved by a motion of the `distribution` kind. The statutes' patronage
terms are the founding assembly's rule `m-2021-001/44`, adopted with the
statutes on 1 March 2021.
