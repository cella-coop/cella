+++
title = "decision-patronage"
updated = 2026-10-25
+++

A year's distribution and the decision of the assembly that approves its
split; the work share's terms and the decision that adopts them.
Declared by `patronage`.

## Schema

`decision_patronage` (`sql/`):

- `decision_patronage.approval`: the distribution and the decision
  approving it, each by id, with no foreign key into either feat.
- the `patronage` kind of motion, "Adopt the work share's terms",
  registered in `decision.kind`, so a new decision's form offers it, with
  the drafted patronage terms as its options (`bases`).
- `decision_patronage.adoption`: the terms and the decision moving to
  adopt them, recorded by `adopts_patronage_terms`, a trigger after a
  motion of the kind is made, which refuses a motion naming no drafted
  terms, whatever wrote it.

The app role may select and insert; the rules role may select.

## Rules

- `decision_patronage.approves`, on `patronage:distribution:approve`: the
  cited decision is the one approving this distribution.
- `decision_patronage.asks`, on `decision:decision:propose`: each motion
  to adopt patronage terms names drafted terms, and the decision asks to
  adopt them.
- `decision_patronage.adopts`, on `patronage:terms:adopt`: the cited
  decision moved to adopt these terms.
- Both ops are listed in `decision.cites`, so `circle-decision-membership`'s
  `carried` attaches to them: the decision closed and passed on its roll.
  Their labels declare `check: 'decided'`.

## Tests

`ts/_tests/terms.test.ts` (`cella test slice decision-patronage`): a
motion to adopt drafted terms records the adoption it asks for, and one
naming no such terms is refused; adopting cites a decision that moved to
adopt the terms, and approving the decision that approves the
distribution, never another; both ops cite a decision.

## Shell

Adds to a distribution's page the decision approving it, and the Approve
form, which posts the patronage feat's write citing that decision; to the
patronage terms' page the decisions moving to adopt them, and the Adopt
form; to a decision's page the distribution it approves and the terms it
adopts; and to a new decision's form the drafted terms it may move to
adopt.

## Lanterne

d-2026-006, a majority of the assembly closed on 20 June 2026, approves
the 2025 distribution. The statutes' patronage terms, `st-2021`, were
adopted with the statutes in 2021, before the books moved here, so no
decision here adopts them.
