+++
title = "decision-member"
updated = 2026-10-24
+++

Admission and suspension by a decision of the members.

## Schema

`decision_member` (`sql/`): `decision_member.admission`, a member a decision asks to admit and the shares they subscribe. It names the decision by id and the member by address, with no foreign key into either feat. The app role may select and insert; the rules role, `cella_rules`, may select.

## Rules

- `decision_member.passes(decision)`: whether a decision passes by its rule, `cella.consent` or `cella.majority`, over the stances received before its cutoff from members who are active and on its roll. The roll is the `circle-decision` graft's (`circle_decision.roll`): the members seated in the decision's circle when it was proposed. d-2026-012, the assembly's, counts the ten seated in `ag`; d-2026-011, coordination's, counts its five.
- `decision_member.admits`, on `member:member:admit`: the cited decision is closed, passes, and asks to admit this member.

## Handlers

- `closed(decision)`: on a settled close, admits each member the decision asks to admit when `decision_member.passes` says it passes, through the member feat's `admit`; each admission is its own ordered write, decided again by its rules.

## Open

`passes` reads `circle_decision.roll`, another graft's table, which the SQL boundaries in [architecture](../../../../_corpus/doc/architecture.md#sql) do not list: a graft reads only its own schema and those of the feats it joins.
