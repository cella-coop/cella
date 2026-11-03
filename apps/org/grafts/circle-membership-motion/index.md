+++
title = "circle-membership-motion"
updated = 2026-11-03
+++

The electorate: who may vote on a motion, and whether it passes on
their stances; and what a passing motion does to members and seats. A
roll is a relation of all three feats: the people seated in a motion's
circle (circle), as the assembly's seats ask a membership (member),
when it was proposed and as its procedure says (motion). Declared by
the `motion` feat.

A three-way graft reads the two-way grafts of its feats, a lower order
([architecture](../../../../_corpus/doc/architecture.md#graft-order)):
seats are `circle-membership`'s, what a motion asks of members
`membership-motion`'s, what it asks of circles `circle-motion`'s. None of
them reads this graft, so the roll and everything that counts it live
here.

## Founding

A co-op is founded once, by the log's first entry, the founding
(`found`, `circle-membership-motion:scope:found`), which a founder signs
from a device it enrols. It lives here because it is what this graft
joins: the founders' memberships, the root circle they sit in, and the
founding motion by which they decide. It names the legal form the co-op
chose ([legal forms](../../../../_corpus/doc/forms.md)) and writes,
inside its transaction as any write's state, the founders as persons
with their devices and their memberships, the root circle with each
founder seated in it, and the root's founding motion, which its founders
decided and which adopts the first policies, each a default of that
form, the procedure the root decides by among them. Its writes are the
fixture's loader's, the seed's (`tools/seed/found.mjs`), never this
graft's SQL. The log keeps the form, where the founding came from and
how many rows of each kind, never the rows. A state table refuses rows
written outside a write
([the notary](../../core/notary/index.md#bound)), so a founding is a
write like any other, judged by its guard, `founds`, and every later
write by the guards its policies set.

`cella seed` founds a mock co-op from its fixture so, signed by the
first device in force it enrols, and the founding carries the state the
mock co-op held before its log too: Lanterne's founding motion, the
assembly of 1 March 2021, and everything since. A fresh scope is founded
from its form alone (`tools/seed/founding.mjs`): its founders, the
assembly `ag`, and a founding motion they consent to, taking every
default of the form. Books come in after the founding, by the import
feat's imports under the importer's mandates
([import](../../feats/import/index.md#after-the-founding)).

The e2e scenario `founding` founds a fresh scope as a SCOP SARL in France
by three founders, whose next write passes the guards its policies set,
and refuses a founding with no procedure for its root, leaving the log
empty, and a second founding; `notarised` finds Lanterne's seed founded
as entry 1.

| Action | Label | Why |
|---|---|---|
| `found`, from `cella seed` | ordered, `first` | a co-op is founded once, as the log's first entry, before any policy grants a power |

## Schema

`circle_membership_motion` (`sql/`):

- `circle_membership_motion.roll`: a motion and a person on its roll, by
  id and address, with no foreign key into any feat, and whether they
  may veto it (`veto`), fixed by `circle_membership_motion.fix(motion)`,
  which this graft's `propose` calls in the proposal's own write, from
  `circle_membership_motion.called(motion)`: the people seated in its
  circle on the day it is proposed, in `circle_membership.seat`, a
  lower-order graft's, by its procedure: every seat, or where it names
  `voters` the seats in those roles (`participant` every seat), and the
  seats in a role it names in `veto`, who may veto. Seats are people's,
  so no agent and no service is ever on a roll, and only the motion's
  own circle's seats are read, so a seat above carries no vote below. `fix` runs
  with its owner's rights, since nothing else writes the roll, and only the app
  role may call it; the app role and the guards role, `cella_guards`, may
  select the roll.
- `circle_membership_motion.counted`: who was counted, the people on a
  motion's roll whose seat counted (`circle_membership.counts`: in the
  assembly an active member, elsewhere one membership has not suspended
  or let go) on the day it closed, fixed by
  `circle_membership_motion.count(motion)`, which this graft's `close`
  calls in the close's own write. A suspension or exit after the close
  cannot change the outcome. `count` runs with its owner's rights,
  since nothing else writes the table, and only the app role may call
  it.
- `circle_membership_motion.seating`: the seats motions give and end: an
  admission's, in the motion's circle as `member`, and those the
  `seat` and `unseat` actions name, kinds this graft registers by
  `motion.register_carries` (`circle`, `member`, `role`, none for a plain seat), carried out by `circle-membership:seat:add` and `:remove`, which it registers by `motion.register_cite` with their power, `seat-member`.

A roll fixed at the proposal is closer to a ballot list than one read at
the close, and a member seated or admitted later does not vote on it.
Lanterne's m-2026-012 is the assembly's: its roll is the ten members seated
in `ag`, and not Inès, whose admission it decides. m-2026-011,
coordination's, counts its five. Inès, invited and employed, sits in
Web, and votes on Web's motions by its procedure as any seat there does;
she is on no roll of the assembly's.

## Guards

- `circle_membership_motion.electorate(motion)`: who counts on it, once
  it is closed the people counted at its close, while it is open the
  people on its roll whose seat counts in its circle on the verdict date
  (`circle_membership.counts`); `stances(motion)`, their
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
  procedure needs, as two thirds, abstentions counting for neither; and
  no veto: no one on the roll who may veto it (`veto`) and counts gave,
  as their latest stance, one against or an objection.
- `circle_membership_motion.on_roll`, on `motion:motion:vote`: the
  actor holds `vote`, the power the motion's procedure gives the seats
  on its roll: they are on the roll, and their seat counts in its
  circle on the verdict date, so a suspended or exited member, or one
  the assembly's seat no longer counts, gives no stance.
- `circle_membership_motion.sits`, on `motion:motion:propose`,
  `motion:motion:close` and `motion:message:post`: the actor holds a
  seat that counts in the motion's circle on the verdict date
  (`circle_membership.sits_in`), so
  the participant's `propose` (propose, close) and `discuss` (post),
  which `circle_membership.may` finds on any seat, are held in the
  motion's circle: a circle's participants put, close and deliberate on
  its motions. A message may be posted, too, from a seat in the circle
  the motion's procedure consults, so that circle is heard.
- `circle_membership_motion.consulted`, on `motion:motion:close`: a
  motion whose procedure consults a circle (`consult`) closes only once
  someone seated in that circle on the day they posted it has said
  something on its deliberation, so a motion of Web under a mandate whose
  chain asks coordination's consultation is refused its close until
  someone of coordination has spoken
  ([procedures](../../feats/motion/index.md#procedures)).
- `circle_membership_motion.asks`, on `motion:motion:propose`: a seat
  given or ended is the motion of the circle above it, or the assembly
  (`circle_motion.decides`), and names for a role of that circle, or as
  a plain seat, an active member in the assembly and elsewhere any
  person whom membership has not suspended or let go; or a seat held. Which circle admits, suspends and lets
  members go is no rule of this graft's: it is the one holding the
  collective mandate for it, `circle-motion`'s guard `empowers`, and in
  Lanterne that is the assembly alone.
- `circle_membership_motion.carried`, on every action in `motion.cites`: the
  motion the payload cites is closed and passes. The motion feat keeps
  that list; a graft that joins motion to a write's feat registers its
  action there with its power by `motion.register_cite` (`membership-motion` for
  admission, suspension and exclusion, `circle-motion` for nesting,
  `document-motion` for `document:document:adopt`, and the
  motion feat itself for `motion:policy:adopt` and `:end`), and this
  graft registers the guard by `motion.register_cite_guard`, which
  attaches it to every action listed, then and later: the motion feat's
  register functions attach it, and this graft puts no trigger on
  `motion.cites`; `circle-motion` covers the same list with `mandated`,
  that the motion's circle holds the power. A graft that cites a motion so never reads
  this one, and this one never names a feat it does not join. This graft
  registers `circle-membership:seat:add` and `:remove` itself, a
  lower-order graft's actions.
- `circle_membership_motion.seats`, on `circle-membership:seat:add`: the
  seat is one the cited motion gives (`seating`), to a person whose seat
  counts there (`circle_membership.counts`), from the verdict date, where they held no such seat. `unseats`, on
  `:remove`: the seat ended on the verdict date, and the cited motion
  ends it. A graft may register guards on the actions of the lower-order
  grafts it builds on, as on its feats'.
- `circle_membership_motion.settles`, on `motion:motion:close`: a
  passing close admitted everyone the motion admits, each seated by
  `seats` as a seat of its own would be; a close that does not pass
  admits no one.
- `circle_membership_motion.counts`, on `motion:motion:close`: those
  counted are exactly the people of the roll whose seat counts in its
  circle on the verdict date, so a close that did not count its roll, as the motion feat's own
  `close` alone does not, is refused.
- `circle_membership_motion.fixed`, on `motion:motion:propose`: the
  motion's roll is exactly those its procedure calls on the day it is
  proposed (`called`), each who may veto marked so, so a proposal that
  did not fix its roll, as the motion feat's own `propose` alone does
  not, is refused.
- `circle_membership_motion.puts`, on `membership:member:apply`: the
  application put the motion to admit the applicant in its own write:
  the motion its payload names asks only to admit them, with the shares
  they pledge, by the procedure its requirements fix, and passes every check a
  proposal does but the seat, each run here over it: `motion.proposes`,
  `balloted` and `decides_by`, `circle_motion.empowers` (its circle holds
  the collective mandate to admit), `circle_motion.requires` (it is
  decided as its requirements fix), `membership_motion.asks` (someone
  invited, a whole number of shares) and `fixed` (its roll). No seat is
  asked of the applicant, whose right puts it, so `sits` is not run; an
  application that puts no motion, as the membership feat's `applying`
  alone does not, is refused.
- `circle_membership_motion.founds`, on `circle-membership-motion:scope:found`, the log's
  first entry, its check `first`: the log is empty, so a co-op is founded
  once; the form the founding names is one cella offers (`policy.form`),
  and its policies take that form's defaults and no other form's, at
  least one of them. Once the founding's state is written, the co-op can
  decide: there is one root circle; it decides by a procedure a policy
  in force there makes, which its founding motion adopted, never only a
  procedure every scope starts with; and the signer sits in it with a
  vote, their seat counting on the verdict date
  (`circle_membership.sits_in`) and, where the procedure names the roles
  that vote, holding one. A founding with no procedure for its root is
  refused, saying so, and leaves the log empty.

## Handlers

- `propose` (confluent), replacing the motion feat's in the shell: the
  motion feat's `proposing`, by the procedure its requirements fix
  (`circle_motion.required`) whatever the proposal names, then `fix`, in
  one transaction under one verdict; the guards of each slice judge it
  (`motion.proposes`, `sits`, `asks`, `fixed`, `circle_motion.requires`,
  and the guard of each action's kind). Every proposal
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
  suspension or an exclusion
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
- `apply` (confluent), an employee's application by their own right
  (`apply-membership`), from their own page: in one transaction under one
  verdict, the membership feat's `applying`, which invites them, the
  motion feat's `proposing` of their admission to the assembly, by the
  procedure its requirements fix and a secret ballot, titled as `put` titles one, and `fix`.
  It submits the application's op, `membership:member:apply`, with the
  application and the proposal in its payload; the guards judge it
  (`membership.applies`, employment-membership's `serves`, `puts`). The
  assembly must rule on it as on any motion: the close admits them, and
  the subscription follows. Its request names the shares, so the
  candidacy employment-membership opens after it pledges them.
- `put`: what a member's or a circle's page proposes, through this
  graft's `propose`, to the circle that decides it, titled with what it decides: a membership to the assembly,
  a seat to the circle above its own. Admitting, suspending or ending a
  membership, and giving or ending a seat, elect or remove a person, so
  `put` names a secret ballot for each.

## Shell

Adds to a motion's page its roll: each person by name,
their latest stance received before the cutoff, whether the close counted them, the outcome
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

In the acting person's inbox, each open motion whose roll they are on,
their seat counting, that they have given no stance on, by its deadline, linking to
its Stances tab.

On a person's page, Propose…: admitting someone invited, with their
shares, suspending an active member or excluding a member, put to the
assembly, and the open motions about them; on an employee's own page,
with no membership or only invited and no motion open to admit them,
Apply to join…: the shares they pledge and the motion's deadline, two
weeks on, and reasons, posted to `apply`. On a circle's page,
Appoint…: seating a member in it, in one of its roles or as a plain
member, or ending a seat held there, put to the circle above; and
circle-motion's Propose…, whose write this graft serves.
