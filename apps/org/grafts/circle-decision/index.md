+++
title = "circle-decision"
updated = 2026-10-24
+++

Who may vote on a decision: its roll, the members seated in its circle on
the day it was proposed. Declared by the `decision` feat, which names its
circle as an id.

## Schema

`circle_decision` (`sql/`):

- `circle_decision.roll`: a decision and a member on its roll, by id and
  address, with no foreign key into either feat.
- `circle_decision.fix_roll`, a trigger after a decision is inserted: it
  fixes the roll from `circle_member.seated(circle, proposed)`. It runs
  with its owner's rights, since nothing else writes the roll; the app role
  and the rules role, `cella_rules`, may select it.

A roll fixed at the proposal is closer to a ballot list than one read at
the close, and a member seated or admitted later does not vote on it.
Lanterne's d-2026-012 is the assembly's: its roll is the ten members seated
in `ag`, and not Inès, whose admission it decides.

## Rules

None of its own. `decision_member.passes` counts only stances from the
roll.

## Open

- The roll reads seats through `circle_member.seated`, the
  `circle-member` graft's function. A seat is a circle and a member, so the
  roll is a relation of circle, decision and member; the SQL boundaries in
  [architecture](../../../../_corpus/doc/architecture.md#sql) let a graft
  read only the feats it joins. Either a graft may read the grafts that
  share its feats, or the roll belongs to a `circle-decision-member` graft.
- The trigger is PL/pgSQL, bound when it runs, since `circle-member`
  migrates after this graft.
