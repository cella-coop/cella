+++
title = "circle-decision"
updated = 2026-11-01
+++

The circles' place and powers, by decision: nesting a circle, granting a
power to a role, revoking a mandate. Declared by the `circle` feat. Who
sits where needs members as well, so seats by decision are
`circle-decision-membership`'s, which builds on this graft.

## Schema

`circle_decision` (`sql/`) holds no table: the motions are the decision
feat's `decision.motion`, of the kinds this graft registers in
`decision.kind`, `nest` (`circle`, `parent`), `grant` (`role`, `power`,
`text`, and a `limit` per write or a `budget` with its `per`, in euros as
the form asks) and `revoke` (`mandate`). `circle_decision.motion` reads
them with the circle each is about: the circle nested, the role's circle,
the revoked mandate's role's circle; a role every working circle has
(`*`) is the assembly's.

## Guards

- `circle_decision.decides(decider, subject)`: a decision of `decider`
  may decide about `subject`: the assembly about every circle, any other
  circle about those strictly within it. A circle does not decide its own
  place or powers; the one above it does.
- `circle_decision.asks`, on `decision:decision:propose`: each motion of
  these kinds names what it applies to (a circle, a role, a power in
  lower case, a cap by limit or by budget per month or year, never both,
  a mandate in force), and the decision's circle may decide it, about the
  circle nested and about the place it moves to.
- `circle_decision.nests`, `.grants`, `.revokes`, on `circle:circle:nest`,
  `circle:mandate:grant` and `circle:mandate:revoke`: the cited decision
  asks exactly this, the grant's euros in cents.

No write sets a circle's procedure: the seed carries it in, and the
fixture check holds it to a procedure the decision feat holds. A write
that sets one will be judged by a guard of this graft's on its action, not by
a trigger on the circle feat's table
([writes stay home](../../../../_corpus/doc/architecture.md#writes-stay-home)).

The three actions cite a decision: this graft lists them in `decision.cites`,
and `circle-decision-membership`, which counts the roll, attaches its guard
that it carried.

## Handlers

- `putting`: the proposal a motion about a circle (`motion`, read from
  its page's form) makes, to the circle that decides it, by its
  procedure: the one above it, or for a nesting the deepest circle
  holding both its place and the one it moves to, or the assembly for
  itself; titled with what it decides. It writes nothing: the circle
  page's `put` is `circle-decision-membership`'s, which proposes it and
  fixes its roll in one write, as only the graft holding the roll can.
  The writes that carry a passing decision out are
  `circle-decision-membership`'s reaction to its close.

## Shell

Adds to the decisions collection's `about` the circles a decision may be
put in, with their procedures, which the decision feat's New form offers.
On a circle's page, which circle decides about it, the open decisions
about it, and Propose…: nesting it under another circle, granting a
mandate to one of its roles, or revoking one, with a deadline and why,
posted to the `put` circle-decision-membership serves.
