+++
title = "motion-patronage"
updated = 2026-11-01
+++

A year's distribution and the motion of the assembly that approves its
split; the work share's terms and the motion that adopts them.
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
- the `patronage` kind of action, "Adopt the work share's terms",
  registered by `motion.register_carries`, so a new motion's form offers it, with
  the drafted patronage terms as its options (`bases`).
- `motion_patronage.adoption`: the terms and the motion moving to
  adopt them, a view of the actions of the `patronage` kind.

The actions are the motion feat's rows, so the graft reads them and
keeps no copy. The app role and the guards role may select.

## Guards

- `motion_patronage.approves`, on `patronage:distribution:approve`, and on
  `patronage:distribution:distribute` and `patronage:part:employ`, which
  follow the approval citing its motion: the cited motion moved to
  approve this distribution.
- `motion_patronage.asks`, on `motion:motion:propose`: each action
  to adopt patronage terms names drafted terms not yet adopted.
- `motion_patronage.asks_to_approve`, on `motion:motion:propose`:
  each action to approve a distribution names a draft not yet approved.
- `motion_patronage.adopts`, on `patronage:terms:adopt`: the cited
  motion moved to adopt these terms.
- The four actions are registered by `motion.register_cite`, so `circle-membership-motion`'s
  `carried` attaches to them: the motion closed and passed on its roll.
  Their labels declare `check: 'decided'`: adopting and approving, the
  distribution and the credits of shares that follow an approval.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice motion-patronage`): a
action to adopt drafted terms is the adoption it asks for, and a proposal
moving to adopt no such terms is refused; adopting cites a motion that
moved to adopt the terms, and approving one that moved to approve the
distribution, never another; a draft moved again is approved by either
motion moving to, and a proposal moving to approve no draft is refused;
the four actions cite a motion, and the distribution and the credits that
follow an approval are judged by the motion it cites.

## Shell

Adds to a distribution's page the motion approving it, and the Approve
form, which posts the patronage feat's write citing that motion; to the
patronage terms' page the motions moving to adopt them, and the Adopt
form; to a motion's page the distribution it approves and the terms it
adopts; and to a new motion's form the drafted terms it may move to
adopt and the drafted distributions it may move to approve.

## Lanterne

m-2026-006, a majority of the assembly closed on 20 June 2026, approves
the 2025 distribution by its action; a later year's is
moved by a motion of the `distribution` kind. The statutes' patronage
terms, `st-2021`, were adopted with the statutes in 2021, before the
books moved here, so no motion here adopts them.
