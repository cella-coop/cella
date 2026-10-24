+++
title = "circle-decision-member"
updated = 2026-10-24
+++

The electorate: who may vote on a decision, and whether it passes on
their stances. A roll is a relation of all three feats: the members (member)
seated in a decision's circle (circle) when it was proposed (decision).
Declared by the `decision` feat.

A three-way graft reads the two-way grafts of its feats, a lower order
([architecture](../../../../_corpus/doc/architecture.md#graft-order)):
seats are `circle-member`'s, admissions `decision-member`'s. Neither of them
reads this graft, so the roll and everything that counts it live here.

## Schema

`circle_decision_member` (`sql/`):

- `circle_decision_member.roll`: a decision and a member on its roll, by
  id and address, with no foreign key into any feat.
- `circle_decision_member.fix_roll`, a trigger after a decision is
  inserted: it fixes the roll from `circle_member.seated(circle, proposed)`.
  It runs with its owner's rights, since nothing else writes the roll; the
  app role and the rules role, `cella_rules`, may select it.
- `circle_decision_member.counted`: who was counted, the members on a
  decision's roll who were active when it closed, fixed by
  `count_roll`, a trigger as the close writes the decision, in the close's
  own transaction. A suspension or exit after the close cannot change the
  outcome; the same trigger rights apply.

A roll fixed at the proposal is closer to a ballot list than one read at
the close, and a member seated or admitted later does not vote on it.
Lanterne's d-2026-012 is the assembly's: its roll is the ten members seated
in `ag`, and not Inès, whose admission it decides. d-2026-011,
coordination's, counts its five.

## Rules

- `circle_decision_member.passes(decision)`: whether a decision passes by
  its rule, `cella.consent` or `cella.majority`, over the stances received
  before its cutoff: once it is closed, from the members counted at its
  close; while it is open, from the members on its roll who are active
  now.
- `circle_decision_member.on_roll`, on `decision:decision:vote`: the
  member is on the decision's roll.
- `circle_decision_member.carried`, on every op in `decision.cites`: the
  decision the payload cites is closed and passes. The decision feat keeps
  that list; a graft that joins decision to a write's feat declares its op
  there (`decision-member` for `member:member:admit`, `decision-document`
  for `document:document:adopt`), and this graft attaches the rule to every
  op listed, then and later. A graft that cites a decision so never reads
  this one, and this one never names a feat it does not join. This graft
  lists `circle-member:position:add` itself, a lower-order graft's op.
- `circle_decision_member.seats`, on `circle-member:position:add`: the
  seat is the one an admission gives: the member the cited decision
  admits (`decision_member.admission`), active, seated from the verdict
  date in the decision's circle in its `member` role, and not already
  seated there. A graft may register rules on the ops of the lower-order
  grafts it builds on, as on its feats'.

## Handlers

- `closed(decision)`: on a settled close, admits each member the decision
  asks to admit (`decision_member.admission`) when it passes, through the
  member feat's `admit`, then seats each one admitted in the decision's
  circle in its `member` role, through `circle-member`'s `add`. Each is
  its own ordered write, decided again by its rules, and a seat follows
  only a settled admission. Lanterne's d-2026-012 seats Inès in `ag`,
  whose `member` role's mandates let her edit clients and documents.
  The two writes are not one transaction: an admission whose seat is
  refused leaves an active member without a seat, until a seat is added
  under the same decision.
