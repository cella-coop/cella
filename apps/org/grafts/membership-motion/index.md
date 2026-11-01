+++
title = "membership-motion"
updated = 2026-11-02
+++

What a motion decides of a membership: admitting someone invited,
suspending a member, ending a membership, erasing a former member's
personal data. Declared by the `membership` feat.

## Schema

`membership_motion` (`sql/`) holds no table: the actions are the motion
feat's `motion.action`, of the kinds this graft registers by
`motion.register_carries`, each with the action that carries it out: `admit` (`member`, `shares`), `suspend`, `exit` and
`erase` (`member`). `membership_motion.action` reads them with the member each
names and, for an admission, the shares as a whole number. The app role
and the guards role, `cella_guards`, may select it.

## Guards

- `membership_motion.asks`, on `motion:motion:propose`: each action of
  these kinds names a member it can apply to: someone invited, with
  shares, to admit; an active member to suspend; an active or suspended
  one to let go; a member who has left to erase. Which circle decides it is
  the one holding the collective mandate for it, `circle-motion`'s
  guard `empowers`.
- `membership_motion.admits`, on `membership:member:admit`: the cited motion
  asks to admit this member, with these shares.
- `membership_motion.ends`, on `membership:member:suspend`, `:exit` and
  `:erase`: the cited motion asks this of this member.
- `membership_motion.mentions`, on `motion:message:post`: each handle a
  message mentions names one member, by `membership_motion.named`: the
  member whose address it is, or for a handle with no `@` whose address
  starts with it; a handle naming no one, or two, is refused.
  `membership_motion.mention` reads who each message mentions.
- `membership_motion.closes`, on `motion:motion:close`: every member a
  close admits, as its payload's `admitted` names them, is one the
  motion asks to admit, holding the shares it asks, and was admitted by
  the close (`membership.admitted`, the membership feat's guard, run for each).

The admission, suspension and exit cite their motion: this graft registers
them by `motion.register_cite`, with their powers, `admit-member`,
`suspend-member`, `end-membership` and for the erasure `erase-member`,
and `circle-membership-motion`, which counts the
roll, attaches its guard that it closed and passed. Whether a close
admits everyone it must, and seats them, needs the roll and seats, so it
is that three-way graft's; this one never reads it.

## Handlers

None of its own: a close that admits, and the suspensions and exits a
passing motion carries out, need the roll, so they are
`circle-membership-motion`'s. What follows each in the books, the member's capital
subscribed, frozen and withdrawn, is the reaction of the grafts joining
`membership` to the books (`account-membership`,
`account-membership-transaction`), each a write of its own after the
admission or the exit, citing the same motion; this graft never reads
it.

## Shell

Adds to a motion's page what it asks of members, whom it admits with
their shares, whom it suspends or lets go, and the `member` embed: each
author and mention in its discussion drawn by name, linking to the
person's page; to a person's page the motions that ask something of
them; and to the acting member's inbox each message on an open motion
that mentions them, by someone else, until they post on that motion
after it.
