+++
title = "circle-membership-motion"
updated = 2026-11-02
+++

The electorate: who may vote on a motion, and whether it passes on
their stances; and what a passing motion does to members and seats. A
roll is a relation of all three feats: the members (member) seated in a
motion's circle (circle) when it was proposed (motion). Declared by
the `motion` feat.

A three-way graft reads the two-way grafts of its feats, a lower order
([architecture](../../../../_corpus/doc/architecture.md#graft-order)):
seats are `circle-membership`'s, what a motion asks of members
`membership-motion`'s, what it asks of circles `circle-motion`'s. None of
them reads this graft, so the roll and everything that counts it live
here.

## Schema

`circle_membership_motion` (`sql/`):

- `circle_membership_motion.roll`: a motion and a member on its roll, by
  id and address, with no foreign key into any feat, fixed by
  `circle_membership_motion.fix(motion)` from
  `circle_membership.seated(circle, proposed)`, which this graft's
  `propose` calls in the proposal's own write. `fix` runs with its
  owner's rights, since nothing else writes the roll, and only the app
  role may call it; the app role and the guards role, `cella_guards`, may
  select the roll.
- `circle_membership_motion.counted`: who was counted, the members on a
  motion's roll who were active (`membership.active`) on the day it
  closed, fixed by `circle_membership_motion.count(motion)`, which this
  graft's `close` calls in the close's own write. A suspension or exit
  after the close cannot change the outcome. `count` runs with its owner's
  rights, since nothing else writes the table, and only the app role may
  call it.
- `circle_membership_motion.seating`: the seats motions give and end: an
  admission's, in the motion's circle as `member`, and those the
  `seat` and `unseat` actions name, kinds this graft registers by
  `motion.register_carries` (`circle`, `member`, `role`, none for a plain seat).

A roll fixed at the proposal is closer to a ballot list than one read at
the close, and a member seated or admitted later does not vote on it.
Lanterne's m-2026-012 is the assembly's: its roll is the ten members seated
in `ag`, and not Inès, whose admission it decides. m-2026-011,
coordination's, counts its five.

## Guards

- `circle_membership_motion.electorate(motion)`: who counts on it, once
  it is closed the members counted at its close, while it is open the
  members on its roll who are active on the verdict date
  (`membership.active`); `stances(motion)`, their
  stances received before its cutoff, but a redacted one; and `turnout(motion)`, how many
  count, how many of them gave a stance, an abstention taking part, and
  whether that meets its procedure's quorum.
- `circle_membership_motion.tally(motion)`: what every member reads of
  a motion's count, whether it passes and its turnout, by `passes` and
  `turnout`; on a secret ballot ([ballots](../../feats/motion/index.md#ballots))
  sealed, every field null, until its close. It runs as its owner, since a
  member reads no other's secret stance, and only the app role may call it.
- `circle_membership_motion.passes(motion)`: whether a motion passes by
  its procedure over those stances: its quorum met, and then by its method,
  `cella.consent`, or for a majority `cella.majority`, more for than
  against, or `cella.share`, at least the share of the votes cast the
  procedure needs, as two thirds, abstentions counting for neither.
- `circle_membership_motion.on_roll`, on `motion:motion:vote`: the
  member is on the motion's roll, and active: a suspended or exited
  member gives no stance.
- `circle_membership_motion.sits`, on `motion:motion:propose`,
  `motion:motion:close` and `motion:message:post`: the actor is an
  active member seated in the motion's circle on the verdict date, so a
  circle's members put, close and deliberate on its motions.
- `circle_membership_motion.asks`, on `motion:motion:propose`: only the
  assembly admits, suspends and lets members go; a seat given or ended is
  the motion of the circle above it, or the assembly
  (`circle_motion.decides`), and names an active member for a role of
  that circle, or a seat held.
- `circle_membership_motion.carried`, on every action in `motion.cites`: the
  motion the payload cites is closed and passes. The motion feat keeps
  that list; a graft that joins motion to a write's feat registers its
  action there by `motion.register_cite` (`membership-motion` for
  admission, suspension and exit, `circle-motion` for nesting,
  `document-motion` for `document:document:adopt`, and the
  motion feat itself for `motion:policy:adopt` and `:end`), and this
  graft registers the guard by `motion.register_cite_guard`, which
  attaches it to every action listed, then and later: the motion feat's
  register functions attach it, and this graft puts no trigger on
  `motion.cites`. A graft that cites a motion so never reads
  this one, and this one never names a feat it does not join. This graft
  registers `circle-membership:seat:add` and `:remove` itself, a
  lower-order graft's actions.
- `circle_membership_motion.seats`, on `circle-membership:seat:add`: the
  seat is one the cited motion gives (`seating`), to an active member,
  from the verdict date, where they held no such seat. `unseats`, on
  `:remove`: the seat ended on the verdict date, and the cited motion
  ends it. A graft may register guards on the actions of the lower-order
  grafts it builds on, as on its feats'.
- `circle_membership_motion.settles`, on `motion:motion:close`: a
  passing close admitted everyone the motion admits, each seated by
  `seats` as a seat of its own would be; a close that does not pass
  admits no one.
- `circle_membership_motion.counts`, on `motion:motion:close`: those
  counted are exactly the members of the roll active on the verdict date,
  so a close that did not count its roll, as the motion feat's own
  `close` alone does not, is refused.
- `circle_membership_motion.fixed`, on `motion:motion:propose`: the
  motion's roll is exactly the members seated in its circle on the day
  it is proposed, so a proposal that did not fix its roll, as the
  motion feat's own `propose` alone does not, is refused.

## Handlers

- `propose` (confluent), replacing the motion feat's in the shell: the
  motion feat's `proposing`, then `fix`, in one transaction under one
  verdict; the guards of each slice judge it (`motion.proposes`, `sits`,
  `asks`, `fixed`, and the guard of each action's kind). Every proposal
  goes through it: the New motion form, `put`, and on a circle's page
  what circle-motion proposes about its place and powers, read by its
  `about` and made by its `putting`.
- `close` (ordered), replacing the motion feat's in the shell: the
  motion feat's `closing`, then `count`, then, when it passes on its
  roll, for each member it admits the membership feat's `admitting` and
  circle-membership's `seating`, all in one transaction under one verdict.
  It submits the close with `admitted`, each member and their seat; the
  guards of each slice judge it (`motion.closes`, `sits`, `counts`,
  `settles`, `membership_motion.closes`), and a refused seat refuses the
  whole close.
- `carried(motion)`: on a settled close of a passing motion, carries
  out its other actions in the order proposed, each its own decided write
  signed as the member who closed it and judged again by its guards: a
  suspension, an exit or the erasure of a former member's personal data
  (membership feat), a nesting
  (circle feat), a seat given or ended (circle-membership), a policy
  adopted or ended, a mandate's with it (circle-motion's `adopt` and
  `end`, which extend the motion feat's), whose request names the
  motion's action, `n`, so the writes that react to an adoption, a rule's
  terms, read the policy it is. A refused one
  leaves the motion passed and that action undone, as its outcome
  says. The slice runs it as its reaction to `motion:motion:close`.
  Before them it reports each admission the close made, as settled in
  the close's entry with the request an admission of its own would
  carry, so the writes that react to an admission, the subscription,
  follow it as they follow one; the shell runs the reactions to each
  write it reports.
- `put`: what a member's or a circle's page proposes, through this
  graft's `propose`, to the circle that decides it, by its
  procedure, titled with what it decides: a membership to the assembly,
  a seat to the circle above its own. Admitting, suspending or ending a
  membership, and giving or ending a seat, elect or remove a person, so
  `put` names a secret ballot for them; an erasure takes the procedure's.

## Shell

Adds to a motion's page its roll: each member's latest stance received
before the cutoff, whether the close counted them, the outcome
`circle_membership_motion.passes` computes by the motion's procedure, how
many of those counted took part against its quorum, and the acting member's own
stance, read by receipt for them. On the roll and open, the stance form
offers the method's stances, starts at their latest and posts the motion
feat's `vote` only for a change; closed, it shows the stance that
counted; off the roll, it says so; and to the list, the
turnout and each motion's state: open, passed or rejected, as `passes`
reads the stances the close froze, in SQL. The outcome, the turnout and
the state are read through `tally`. On a secret ballot the roll lists who
may vote and whom the close counted, never a stance; the outcome and the
turnout read sealed until the close, on the page and in the list; and
the acting member still sees and changes their own. With it comes the board
motions open as, grouped by state;
dragging an open motion into Passed or Rejected is the close, posted
as its button posts it, the database deciding which column it lands in,
and a refused close leaves the card open. On a motion's page, the
outcome sits in its Overview, the roll and the stance form in its
Stances tab; the writes a close carried out show as what followed it.

In the acting member's inbox, each open motion whose roll they are on,
active, that they have given no stance on, by its deadline, linking to
its Stances tab.

On a person's page, Propose…: admitting someone invited, with their
shares, suspending an active member or ending a membership, put to the
assembly, and the open motions about them. On a circle's page,
Appoint…: seating a member in it, in one of its roles or as a plain
member, or ending a seat held there, put to the circle above; and
circle-motion's Propose…, whose write this graft serves.
