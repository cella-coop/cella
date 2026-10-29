+++
title = "decision-patronage"
updated = 2026-10-29
+++

A year's distribution and the decision of the assembly that approves its
split; the work share's terms and the decision that adopts them.
Declared by `patronage`.

## Schema

`decision_patronage` (`sql/`):

- `decision_patronage.approval`: each distribution and the decisions
  moving to approve it, a view of the motions of the `distribution` kind.
  A draft moved again, after a decision that failed, has both; approving
  it cites the one that passed.
- the `distribution` kind of motion, "Approve a year's distribution",
  registered in `decision.kind`, with the drafted distributions as its
  options (`distributions`).
- the `patronage` kind of motion, "Adopt the work share's terms",
  registered in `decision.kind`, so a new decision's form offers it, with
  the drafted patronage terms as its options (`bases`).
- `decision_patronage.adoption`: the terms and the decision moving to
  adopt them, a view of the motions of the `patronage` kind.

The motions are the decision feat's rows, so the graft reads them and
keeps no copy. The app role and the rules role may select.

## Rules

- `decision_patronage.approves`, on `patronage:distribution:approve`: the
  cited decision moved to approve this distribution.
- `decision_patronage.asks`, on `decision:decision:propose`: each motion
  to adopt patronage terms names drafted terms not yet adopted.
- `decision_patronage.asks_to_approve`, on `decision:decision:propose`:
  each motion to approve a distribution names a draft not yet approved.
- `decision_patronage.adopts`, on `patronage:terms:adopt`: the cited
  decision moved to adopt these terms.
- Both ops are listed in `decision.cites`, so `circle-decision-membership`'s
  `carried` attaches to them: the decision closed and passed on its roll.
  Their labels declare `check: 'decided'`.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice decision-patronage`): a
motion to adopt drafted terms is the adoption it asks for, and a proposal
moving to adopt no such terms is refused; adopting cites a decision that
moved to adopt the terms, and approving one that moved to approve the
distribution, never another; a draft moved again is approved by either
decision moving to, and a proposal moving to approve no draft is refused;
both ops cite a decision.

## Shell

Adds to a distribution's page the decision approving it, and the Approve
form, which posts the patronage feat's write citing that decision; to the
patronage terms' page the decisions moving to adopt them, and the Adopt
form; to a decision's page the distribution it approves and the terms it
adopts; and to a new decision's form the drafted terms it may move to
adopt and the drafted distributions it may move to approve.

## Lanterne

d-2026-006, a majority of the assembly closed on 20 June 2026, approves
the 2025 distribution by its motion; a later year's is
moved by a decision of the `distribution` kind. The statutes' patronage
terms, `st-2021`, were adopted with the statutes in 2021, before the
books moved here, so no decision here adopts them.
