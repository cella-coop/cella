+++
title = "circle-decision-member"
updated = 2026-10-24
+++

The electorate: who may vote on a decision, and whether it passes on
their stances; and what a passing decision does to members and seats. A
roll is a relation of all three feats: the members (member) seated in a
decision's circle (circle) when it was proposed (decision). Declared by
the `decision` feat.

A three-way graft reads the two-way grafts of its feats, a lower order
([architecture](../../../../_corpus/doc/architecture.md#graft-order)):
seats are `circle-member`'s, what a decision asks of members
`decision-member`'s, what it asks of circles `circle-decision`'s. None of
them reads this graft, so the roll and everything that counts it live
here.

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
- `circle_decision_member.seating`: the seats decisions give and end: an
  admission's, in the decision's circle as `member`, and those the
  `seat` and `unseat` motions name, kinds this graft registers in
  `decision.kind` (`circle`, `member`, `role`, none for a plain seat).

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
  member is on the decision's roll, and active: a suspended or exited
  member gives no stance.
- `circle_decision_member.sits`, on `decision:decision:propose` and
  `decision:decision:close`: the actor is an active member seated in the
  decision's circle on the verdict date.
- `circle_decision_member.asks`, on `decision:decision:propose`: only the
  assembly admits, suspends and lets members go; a seat given or ended is
  the decision of the circle above it, or the assembly
  (`circle_decision.decides`), and names an active member for a role of
  that circle, or a seat held.
- `circle_decision_member.carried`, on every op in `decision.cites`: the
  decision the payload cites is closed and passes. The decision feat keeps
  that list; a graft that joins decision to a write's feat declares its op
  there (`decision-member` for admission, suspension and exit,
  `circle-decision` for nesting and mandates, `decision-document` for
  `document:document:adopt`), and this graft attaches the rule to every
  op listed, then and later. A graft that cites a decision so never reads
  this one, and this one never names a feat it does not join. This graft
  lists `circle-member:position:add` and `:remove` itself, a lower-order
  graft's ops.
- `circle_decision_member.seats`, on `circle-member:position:add`: the
  seat is one the cited decision gives (`seating`), to an active member,
  from the verdict date, where they held no such seat. `unseats`, on
  `:remove`: the seat ended on the verdict date, and the cited decision
  ends it. A graft may register rules on the ops of the lower-order
  grafts it builds on, as on its feats'.
- `circle_decision_member.settles`, on `decision:decision:close`: a
  passing close admitted everyone the decision admits, each seated by
  `seats` as a seat of its own would be; a close that does not pass
  admits no one.

## Handlers

- `close` (ordered), replacing the decision feat's in the shell: the
  decision feat's `closing`, then, when it passes on its roll, for each
  member it admits the member feat's `admitting` and circle-member's
  `seating`, all in one transaction under one verdict, which
  `key-member`'s trigger follows by enrolling each one's first device.
  It submits the close with `admitted`, each member and their seat; the
  rules of each slice judge it (`decision.closes`, `sits`, `settles`,
  `decision_member.closes`), and a refused seat, or an invitation that
  carries no device, refuses the whole close.
- `carried(decision)`: on a settled close of a passing decision, carries
  out its other motions in the order proposed, each its own decided write
  signed as the member who closed it and judged again by its rules: a
  suspension, an exit or the erasure of a former member's personal data
  (member feat), a nesting, a grant or a revocation
  (circle feat), a seat given or ended (circle-member). A refused one
  leaves the decision passed and that motion undone, as its outcome
  says. The slice runs it as its reaction to `decision:decision:close`.
- `put`: what a member's or a circle's page proposes, through the
  decision feat's `propose`, to the circle that decides it, by its
  procedure, titled with what it decides: a membership to the assembly,
  a seat to the circle above its own.

## Shell

Adds to a decision's page its roll: each member's latest stance received
before the cutoff, whether the close counted them, the outcome
`circle_decision_member.passes` computes, and the acting member's own
stance, read by receipt for them. On the roll and open, the stance form
offers the rule's stances, starts at their latest and posts the decision
feat's `vote` only for a change; closed, it shows the stance that
counted; off the roll, it says so; and to the list, the
turnout and each decision's state: open, passed or rejected, as `passes`
reads the stances the close froze, in SQL. With it comes the board
decisions open as, grouped by state;
dragging an open decision into Passed or Rejected is the close, posted
as its button posts it, the database deciding which column it lands in,
and a refused close leaves the card open. On a decision's page, the
outcome sits in its Overview, the roll and the stance form in its
Stances tab; the writes a close carried out show as what followed it.

On a member's page, Propose…: admitting someone invited, with their
shares, suspending an active member or ending a membership, put to the
assembly, and the open decisions about them. On a circle's page,
Appoint…: seating a member in it, in one of its roles or as a plain
member, or ending a seat held there, put to the circle above.
