+++
title = "decision-membership"
updated = 2026-10-25
+++

What a decision decides of a membership: admitting someone invited,
suspending a member, ending a membership, erasing a former member's
personal data. Declared by the `membership` feat.

## Schema

`decision_membership` (`sql/`) holds no table: the motions are the decision
feat's `decision.motion`, of the kinds this graft registers in
`decision.kind`: `admit` (`member`, `shares`), `suspend`, `exit` and
`erase` (`member`). `decision_membership.motion` reads them with the member each
names and, for an admission, the shares as a whole number. The app role
and the rules role, `cella_rules`, may select it.

## Rules

- `decision_membership.asks`, on `decision:decision:propose`: each motion of
  these kinds names a member it can apply to: someone invited, with
  shares, to admit; an active member to suspend; an active or suspended
  one to let go; a member who has left to erase. That only the assembly decides it is
  `circle-decision-membership`'s, which knows circles.
- `decision_membership.admits`, on `membership:member:admit`: the cited decision
  asks to admit this member, with these shares.
- `decision_membership.ends`, on `membership:member:suspend`, `:exit` and
  `:erase`: the cited decision asks this of this member.
- `decision_membership.mentions`, on `decision:message:post`: each handle a
  message mentions names one member, by `decision_membership.named`: the
  member whose address it is, or for a handle with no `@` whose address
  starts with it; a handle naming no one, or two, is refused.
  `decision_membership.mention` reads who each message mentions.
- `decision_membership.closes`, on `decision:decision:close`: every member a
  close admits, as its payload's `admitted` names them, is one the
  decision asks to admit, holding the shares it asks, and was admitted by
  the close (`membership.admitted`, the membership feat's rule, run for each).

The admission, suspension and exit cite their decision: this graft lists
them in `decision.cites`, and `circle-decision-membership`, which counts the
roll, attaches its rule that it closed and passed. Whether a close
admits everyone it must, and seats them, needs the roll and seats, so it
is that three-way graft's; this one never reads it.

## Handlers

None of its own: a close that admits, and the suspensions and exits a
passing decision carries out, need the roll, so they are
`circle-decision-membership`'s.

## Shell

Adds to a decision's page what it asks of members, whom it admits with
their shares, whom it suspends or lets go, and the `member` embed: each
author and mention in its discussion drawn by name, linking to the
person's page; to a person's page the decisions that ask something of
them; and to the acting member's inbox each message on an open decision
that mentions them, by someone else, until they post on that decision
after it.
