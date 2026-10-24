+++
title = "decision-member"
updated = 2026-10-24
+++

Admission and suspension by a decision of the members.

## Schema

`decision_member` (`sql/`): `decision_member.admission`, a member a decision asks to admit and the shares they subscribe. It names the decision by id and the member by address, with no foreign key into either feat. The app role may select and insert.

## Rules

- `decision_member.passes(decision)`: whether a decision passes by its rule, `cella.consent` or `cella.majority`, over the stances of active members received before its cutoff.
- `decision_member.admits`, on `member:member:admit`: the cited decision is closed, passes, and asks to admit this member.

Every active member counts as the assembly: the circle a decision belongs to is not yet resolved against positions, which are the `circle-member` graft's.

## Handlers

- `closed(decision)`: on a settled close, admits each member the decision asks to admit when `decision_member.passes` says it passes, through the member feat's `admit`; each admission is its own ordered write, decided again by its rules.
