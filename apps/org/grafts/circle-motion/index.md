+++
title = "circle-motion"
updated = 2026-11-03
+++

The circles' place and powers, by motion: nesting a circle, and the
mandates its roles hold, each a policy a circle adopts and ends
([mandates](../../feats/circle/index.md#mandates)). Declared by the
`circle` feat. Who sits where needs members as well, so seats by motion
are `circle-membership-motion`'s, which builds on this graft.

## Schema

`circle_motion` (`sql/`) holds no table: the actions are the motion
feat's `motion.action`, of the kind this graft registers by
`motion.register_carries`, `nest` (`circle`, `parent`), and of the
motion feat's own, `policy` and `end`. `circle_motion.action` reads
them with the circle each is about: the circle nested; for a mandate
policy, the circle of the role it marks, or the circle it marks for a
collective mandate; for an end, the circle of the ended policy's
mandate. A role every working circle has (`*`) is the assembly's.

## Guards

- `circle_motion.decides(decider, subject)`: a motion of `decider`
  may decide about `subject`: the assembly about every circle, any other
  circle about those strictly within it. A circle does not decide its own
  place or powers; the one above it does.
- `circle_motion.asks`, on `motion:motion:propose`: each nesting names
  its circle and its place, each mandate policy marks sound values
  (`circle.mandate_flaw`: a role or a circle, a power in lower case, a
  cap by limit or by budget per month or year, never both, perhaps a
  procedure, and nothing else), a mandate's procedure is one the motion
  feat holds, a procedure policy consults, if any, a circle there is, and
  the motion's circle may decide it: about the circle nested
  and about the place it moves to, about the role's circle or the
  circle a collective mandate is on, and about the circle of the
  mandate it ends.
- `circle_motion.empowers`, on `motion:motion:propose`: the motion's
  circle holds, on the verdict date, a collective mandate
  (`circle.holds`) for the power of every action the motion carries:
  the power `motion.cites` lists for the action that carries out its
  kind (`motion.carries.op`). A motion of Web admitting a member is
  refused at its proposal, since Web holds no `admit-member`.
- `circle_motion.mandated`, on every action in `motion.cites`: the cited
  motion's circle holds, on the verdict date, a collective mandate for
  the power `motion.cites` lists for the action, so a mandate revoked
  between the proposal and the close carries nothing. This graft
  registers it by `motion.register_cite_guard`, beside
  `circle-membership-motion`'s `carried`. An admission settles inside
  the close, under the close's guards, so `empowers` checks it at the
  proposal alone.
- `circle_motion.required(circle, actions, day)`: the procedure a motion
  of `circle` carrying `actions` is decided by, its requirements
  ([policies](../../../../_corpus/doc/architecture.md#policies)): for
  each action, what the chain of the collective mandate its circle holds
  for the action's power on the day asks (`circle_motion.asks_of`, the
  nearest procedure stated on `circle.chain`), the first standing by id;
  and for each policy it replaces or ends, the procedure protecting it.
  It is the one of them as strict as all the others, or the circle's
  procedure where none asks one, or none where no one meets them all.
  `circle_motion.requirements` lists them, each with why it is asked.
- `circle_motion.requires`, on `motion:motion:propose`: the motion is
  decided by what `required` fixes on the verdict date, so a proposal
  naming another, or whose requirements no one procedure meets, is
  refused saying what they ask.
- `circle_motion.nests`, on `circle:circle:nest`: the cited motion
  nests exactly this circle there.
- On `motion:policy:adopt` and `motion:policy:end`, the circle feat's
  guards, which this graft attaches as the graft joining the two:
  `circle.grants` that a mandate policy adopted has its mandate as its
  values say, `circle.revokes` that one ended has its mandate revoked,
  and `circle.narrows` on both that every mandate standing is a root
  the assembly issued or is issued under a parent its issuer holds,
  and is narrower than it. So a motion of coordination grants a
  working circle's role a mandate only under one coordination holds for
  the power, within its cap and its term. And `circle_motion.passes_down`
  on adoption, as the graft that knows both mandates and procedures:
  a mandate adopted stating a procedure states one at least as strict
  (`motion.as_strict`) as what its parent's chain asks, so a procedure
  passes down the chain and no mandate issued under it loosens it.

No write sets a circle's procedure: the seed carries it in, and the
fixture check holds it to a procedure the motion feat holds, built in or
made by a procedure policy the fixture's motions carry. A write
that sets one will be judged by a guard of this graft's on its action, not by
a trigger on the circle feat's table
([writes stay home](../../../../_corpus/doc/architecture.md#writes-stay-home)).

The nesting cites a motion: this graft registers it by `motion.register_cite`
with its power, `nest-circle`, and the kind `nest` with the action that
carries it out, and `circle-membership-motion`, which counts the roll,
attaches its guard that it carried; the motion feat registers its
adoption and ending of a policy so itself.

## Handlers

- `adopt` and `end` (ordered): the motion feat's `adopting` and
  `ending`, extended in their one transaction under one verdict by the
  circle feat's `granting` and `revoking`, so a mandate policy's values
  are copied into its mandate as it is adopted, and its mandate revoked
  as it ends, by the policy's own write. They submit the motion feat's
  payload with the mandate, or none for a policy of another kind.
  `circle-membership-motion` carries out every policy a passing motion
  adopts or ends through them.
- `putting`: the proposal a motion about a circle (`about`, read from
  its page's form) makes, to the circle that decides it, naming no
  procedure, since `circle-membership-motion`'s `propose` gives it the
  one its requirements fix: the one above it, or for a nesting the deepest circle
  holding both its place and the one it moves to, or the assembly for
  itself; titled with what it decides. Granting a mandate is proposing
  its policy, its legal wording made from the role, the power, what it
  grants in words and its cap, each value marked
  (`The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 3 000 €} a write`);
  revoking one is proposing to end its policy, put to the circle that
  adopted it, since a policy is ended by its own circle: a mandate the
  assembly adopted is the assembly's to end. It writes nothing: the circle
  page's `put` is `circle-membership-motion`'s, which proposes it and
  fixes its roll in one write, as only the graft holding the roll can.
  The writes that carry a passing motion out are
  `circle-membership-motion`'s reaction to its close.

## Shell

Adds to the motions collection's `about` the circles a motion may be
put in, which the motion feat's New form offers.
On a circle's page, which circle decides about it, the open motions
about it, and Propose…: nesting it under another circle, granting a
mandate to one of its roles, or revoking one, with a deadline and why,
posted to the `put` circle-membership-motion serves; and its Policies,
the policies it adopted that are in force, each as its legal wording
reads (`policy.sentence`), its kind, whether it takes a default of the
co-op's legal form (Default, or Default, since updated, where cella has
changed that default since) or is the co-op's own, the motion that
adopted it, linked, and the days it applies from and until, read from
the register in org's core (`inForce` in `@cella/org-policy`); and,
where the circle left any, its Defaults left: each default of its form
it left or never took, its sentence, its form, the motion's action that
left it, linked, and the day (`departures`,
[legal forms](../../../../_corpus/doc/forms.md)).
