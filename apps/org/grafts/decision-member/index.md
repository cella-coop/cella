+++
title = "decision-member"
updated = 2026-10-24
+++

Admission and suspension by a decision of the members.

## Schema

`decision_member` (`sql/`): `decision_member.admission`, a member a decision asks to admit and the shares they subscribe. It names the decision by id and the member by address, with no foreign key into either feat. The app role may select and insert; the rules role, `cella_rules`, may select.

## Rules

- `decision_member.admits`, on `member:member:admit`: the cited decision asks to admit this member.

An admission cites its decision: this graft declares `member:member:admit` in `decision.cites`, and `circle-decision-member`, which counts the roll, attaches its rule that the decision closed and passed. Who is on a roll needs seats, so it is that three-way graft's, which reads this one; this one does not read it.

## Handlers

None of its own: the reaction that admits on a passing close needs the roll, so it is `circle-decision-member`'s `closed`.

## Shell

Adds whom a decision admits, with their shares, to the decision's page,
and the decision admitting a member to theirs.
