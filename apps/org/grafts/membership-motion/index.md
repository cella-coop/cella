+++
title = "membership-motion"
updated = 2026-11-06
+++

What a motion decides of a membership: admitting someone invited,
suspending a member, excluding a member; and who may vote on a motion
of a circle, whether it passes, and the seats it gives and ends
([circles](#circles)). Declared by the `membership` feat.

## Schema

`membership_motion` (`sql/`) holds no table: the actions are the motion
feat's `motion.action`, of the kinds this graft registers by
`motion.register_carries`, each with the action that carries it out: `admit` (`member`, `shares`), `suspend` and `exclude`
(`member`). `membership_motion.action` reads them with the member each
names and, for an admission, the shares as a whole number. The app role
and the guards role, `cella_guards`, may select it. It reads as its reader, as `seating` and `mention` do.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `membership_motion.asks`, on `motion:motion:propose`: each action of
  these kinds names a member it can apply to: someone invited, with
  shares, to admit; an active member to suspend; an active or suspended
  one to exclude. Which circle decides it is
  the one holding the collective mandate for it, the motion feat's
  guard `empowers`.
- `membership_motion.admits`, on `membership:member:admit`: the cited motion
  asks to admit this member, with these shares.
- `membership_motion.ends`, on `membership:member:suspend` and `:exclude`:
  the cited motion asks this of this member.
- `membership_motion.mentions`, on `motion:message:post`: each handle a
  message mentions names one member, by `membership_motion.named`: the
  member whose address it is, or for a handle with no `@` whose address
  starts with it; a handle naming no one, or two, is refused.
  `membership_motion.mention` reads who each message mentions.
- `membership_motion.closes`, on `membership:member:admit` as an effect
  of a close: the member it admits is one the motion asks to admit,
  holding the shares it asks, and seated as the motion's circle asks
  (`membership.admitted`, the membership feat's guard).

The admission, suspension and exclusion cite their motion: this graft registers
them by `motion.register_cite`, with their powers, `admit-member`,
`suspend-member` and `exclude-member`,
and this graft, which counts the roll, attaches its guard that it
closed and passed; that each admission seats its member is the roll's
too ([circles](#circles)). A member's
withdrawal, and their erasure once they have left, are their own rights,
no motion's, so neither is this
graft's ([membership](../../feats/person/feats/membership/index.md)).

## Handlers

None of its own: a close that admits, and the suspensions and exclusions a
passing motion carries out, need the roll, so they are
`membership-motion`'s. What follows each in the books, the member's capital
subscribed, frozen and withdrawn, is the reaction of the grafts joining
`membership` to the books (`account-membership`,
`account-membership-transaction`), each an effect citing the admission
or the exclusion in the close's transaction, the subscription one the
admission requires; this graft never reads it.

## Shell

Adds to a motion's page what it asks of members, whom it admits with
their shares, whom it suspends or excludes, and the `member` embed: each
author and mention in its discussion drawn by name, linking to the
person's page; to a person's page the motions that ask something of
them; and to the acting member's inbox each message on an open motion
that mentions them, by someone else, until they post on that motion
after it.

## Circles

The electorate: who may vote on a motion, and whether it passes on
their stances; and what a passing motion does to members and seats. A
roll is a relation of the graft's feats and core's circles: the people
seated in a motion's circle (core), as the assembly's seats ask a
membership (member), when it was proposed and as its procedure says
(motion). Seats are core's and whether one counts the membership
feat's, what a motion asks of circles the motion feat's; none of them
reads this graft, so the roll and everything that counts it live here
(`004-circle.sql` to `016-founding.sql`, and in the shell
`membership-motion/circles`, `api/circles.ts` and `app/circles.ts`).

### Founding

A co-op is founded once, by the log's first entry, the founding
(`found`, `membership-motion:scope:found`), which a founder signs
from a device it enrols. It lives here because it is what this graft
joins: the founders' memberships, the assembly they sit in, and the
founding motion by which they decide. It names the legal form the co-op
chose ([legal forms](../../../../_corpus/doc/forms.md)) and writes,
inside its transaction as any write's state, the founders as persons
with their devices and their memberships, the assembly with each
founder seated in it, and the assembly's founding motion, which its founders
decided and which adopts the first policies, each a default of that
form, the procedure the assembly decides by among them. Its writes are the
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

### Schema of the roll

`membership_motion`, its roll's part (`004-circle.sql` to `016-founding.sql`):

- `membership_motion.roll`: a motion and a person on its roll, by
  id and address, with no foreign key into any feat, and whether they
  may veto it (`veto`), fixed by `membership_motion.fix(motion)`,
  which this graft's `propose` calls in the proposal's own write, from
  `membership_motion.called(motion)`: the people seated in its
  circle on the day it is proposed, in core's `circle.seat`, by its
  procedure: every seat, or where it names
  `voters` the seats in those roles (`participant` every seat), and the
  seats in a role it names in `veto`, who may veto. Seats are people's,
  so no agent and no service is ever on a roll, and only the motion's
  own circle's seats are read, so a seat in one circle carries no vote in another. `fix` runs
  with its owner's rights, since nothing else writes the roll, and only the app
  role may call it; the app role and the guards role, `cella_guards`, may
  select the roll.
- `membership_motion.counted`: who was counted, the people on a
  motion's roll whose seat counted (`membership.counts`: in the
  assembly an active member, elsewhere one membership has not suspended
  or let go) on the day it closed, fixed by
  `membership_motion.count(motion)`, which this graft's `close`
  calls in the close's own write. A suspension or exit after the close
  cannot change the outcome. `count` runs with its owner's rights,
  since nothing else writes the table, and only the app role may call
  it.
- `membership_motion.seating`: the seats motions give and end: an
  admission's, in the motion's circle as `member`, and those the
  `seat` and `unseat` actions name, kinds this graft registers by
  `motion.register_carries` (`circle`, `member`, `role`, none for a plain seat), carried out by `circle:seat:add` and `:remove`, which it registers by `motion.register_cite` with their power, `seat-member`. The `seat-role` and `unseat-role` actions, which it registers too (`circle`, `role`), seat a role in another circle, so whoever holds it sits there, and end that seat, carried out by core's `circle:role:seat` and `:unseat` with the same power; they are no row of `seating`, which is people's seats. The `circle` action, which this graft registers too (`id`, `name`, `purpose`), creates a circle, carried out by core's `circle:circle:create` with its power, `create-circle`; a later `seat` of the same motion may name it.

A roll fixed at the proposal is closer to a ballot list than one read at
the close, and a member seated or admitted later does not vote on it.
Lanterne's m-2026-012 is the assembly's: its roll is the ten members seated
in `ag`, and not Inès, whose admission it decides. m-2026-011,
coordination's, counts its five. Inès, invited and employed, sits in
Web, and votes on Web's motions by its procedure as any seat there does;
she is on no roll of the assembly's.

### Guards of the roll

- `membership_motion.electorate(motion)`: who counts on it, once
  it is closed the people counted at its close, while it is open the
  people on its roll whose seat counts in its circle on the verdict date
  (`membership.counts`); `stances(motion)`, their
  stances received before its cutoff, but a redacted one; and `turnout(motion)`, how many
  count, how many of them gave a stance, an abstention taking part, and
  whether that meets its procedure's quorum.
- `membership_motion.tally(motion)`: what a reader of the motion reads
  of its count, whether it passes and its turnout, by `passes` and
  `turnout`; on a secret ballot ([ballots](../../feats/motion/index.md#ballots))
  sealed, every field null, until its close. It runs as its owner, since a
  member reads no other's secret stance, and only the app role may call it;
  it keeps the count to whoever reads the motion in its circle and to a
  write, every field null to anyone else, and is declared `audience:
  shared by ref` ([reading](../../../../_corpus/doc/architecture.md#reading)).
- `membership_motion.passes(motion)`: whether a motion passes by
  its procedure over those stances: its quorum met, and then by its method,
  `cella.consent`, or for a majority `cella.majority`, more for than
  against, or `cella.share`, at least the share of the votes cast the
  procedure needs, as two thirds, abstentions counting for neither; and
  no veto: no one on the roll who may veto it (`veto`) and counts gave,
  as their latest stance, one against or an objection.
- `membership_motion.on_roll`, on `motion:motion:vote`: the
  actor holds `vote`, the power the motion's procedure gives the seats
  on its roll: they are on the roll, and their seat counts in its
  circle on the verdict date, so a suspended or exited member, or one
  the assembly's seat no longer counts, gives no stance.
- `membership_motion.sits`, on `motion:motion:propose`,
  `motion:motion:close` and `motion:message:post`: the actor holds a
  seat that counts in the motion's circle on the verdict date
  (`membership.sits_in`), so
  the participant's `propose` (propose, close) and `discuss` (post),
  which `membership.may` finds on any seat, are held in the
  motion's circle: a circle's participants put, close and deliberate on
  its motions. A message may be posted, too, from a seat in the circle
  the motion's procedure consults, so that circle is heard.
- `membership_motion.consulted`, on `motion:motion:close`: a
  motion whose procedure consults a circle (`consult`) closes only once
  someone seated in that circle on the day they posted it has said
  something on its deliberation, so a motion of Web under a mandate whose
  chain asks coordination's consultation is refused its close until
  someone of coordination has spoken
  ([procedures](../../feats/motion/index.md#procedures)).
- `membership_motion.circle_asks`, on `motion:motion:propose`: a seat
  given or ended is the motion of a circle that may decide about it,
  never itself but for the assembly (`motion.decides`), and names for a role of that circle, or as
  a plain seat, an active member in the assembly and elsewhere any
  person whom membership has not suspended or let go; or a seat held. A
  seat names a circle there is, or one an earlier `circle` action of the
  same motion creates. Which circle admits, suspends and lets
  members go is no rule of this graft's: it is the one holding the
  collective mandate for it, the motion feat's guard `empowers`, and in
  Lanterne that is the assembly alone.
- `membership_motion.carried`, on every action in `motion.cites`: the
  motion the payload cites is closed and passes. The motion feat keeps
  that list; a graft that joins motion to a write's feat registers its
  action there with its power by `motion.register_cite` (`membership-motion` for
  admission, suspension and exclusion,
  `document-motion` for `document:document:adopt`, and the
  motion feat itself for `motion:policy:adopt` and `:end`), and this
  graft registers the guard by `motion.register_cite_guard`, which
  attaches it to every action listed, then and later: the motion feat's
  register functions attach it, and this graft puts no trigger on
  `motion.cites`; the motion feat covers the same list with `mandated`,
  that the motion's circle holds the power. A graft that cites a motion so never reads
  this one, and this one never names a feat it does not join. This graft
  registers `circle:seat:add` and `:remove`, and `circle:role:seat` and
  `:unseat`, itself, core's actions.
- `membership_motion.role_asks`, on `motion:motion:propose`: a role
  seated in a circle or unseated is the motion of a circle that may
  decide who sits there (`motion.decides`), and its terms pass
  `membership_motion.role_terms`, which judges them again as the seat is
  written: the circle is one there is, or one an earlier `circle`
  action of the same motion creates; the role is one there is, and not
  the circle's own, whose holders sit there by their tenures; it sits
  in the circle once; and an unseat names a seat the role holds there.
  Each refusal names the role and the circle and what would fix it:
  another circle, or ending the seat that runs first.
- `membership_motion.seats_role`, on `circle:role:seat`: the seat is a
  role's membership the write added from the verdict date, which the
  cited motion gives, on the terms `role_terms` judges, the seat itself
  aside. `unseats_role`, on `:unseat`: the role's seat ended on the
  verdict date, and the cited motion ends it.
- `membership_motion.seats`, on `circle:seat:add`: the
  seat is one the cited motion gives (`seating`), to a person whose seat
  counts there (`membership.counts`), from the verdict date, where they held no such seat. `unseats`, on
  `:remove`: the seat ended on the verdict date, and the cited motion
  ends it. `membership_motion.creates`, on `circle:circle:create`: the
  circle the write made is one the cited motion creates, by its id, name
  and purpose, and the payload names the bundle in force on the verdict
  date (`circle.bundle`). A slice may register guards on core's actions,
  as on its feats'.
- `membership_motion.counts`, on `motion:motion:close`: those
  counted are exactly the people of the roll whose seat counts in its
  circle on the verdict date, so a close that did not count its roll, as the motion feat's own
  `close` alone does not, is refused.
- `membership_motion.fixed`, on `motion:motion:propose`: the
  motion's roll is exactly those its procedure calls on the day it is
  proposed (`called`), each who may veto marked so, so a proposal that
  did not fix its roll, as the motion feat's own `propose` alone does
  not, is refused.
- `membership_motion.puts`, on `membership:member:apply`: the
  application put the motion to admit the applicant in its own write:
  the motion its payload names asks only to admit them, with the shares
  they pledge, by the procedure its requirements fix, and passes every check a
  proposal does but the seat, each run here over it: `motion.proposes`,
  `balloted` and `decides_by`, `motion.empowers` (its circle holds
  the collective mandate to admit), `motion.requires` (it is
  decided as its requirements fix), `membership_motion.asks` (someone
  invited, a whole number of shares) and `fixed` (its roll). No seat is
  asked of the applicant, whose right puts it, so `sits` is not run; an
  application that puts no motion, as the membership feat's `applying`
  alone does not, is refused.
- `membership_motion.founds`, on `membership-motion:scope:found`, the log's
  first entry, its check `first`: the log is empty, so a co-op is founded
  once; the form the founding names is one cella offers (`policy.form`),
  and its policies take that form's defaults and no other form's, at
  least one of them. Once the founding's state is written, the co-op can
  decide: there is one assembly; it decides by a procedure a policy
  in force there makes, which its founding motion adopted, never only a
  procedure every scope starts with; and the signer sits in it with a
  vote, their seat counting on the verdict date
  (`membership.sits_in`) and, where the procedure names the roles
  that vote, holding one. A founding with no procedure for its root is
  refused, saying so, and leaves the log empty.

### Handlers of the roll

- `propose` (confluent), replacing the motion feat's in the shell: the
  motion feat's `proposing`, by the procedure its requirements fix
  (`motion.required`) whatever the proposal names, then `fix`, in
  one transaction under one verdict; the guards of each slice judge it
  (`motion.proposes`, `sits`, `asks`, `fixed`, `motion.requires`,
  and the guard of each action's kind). Every proposal
  goes through it: the New motion form, `put`, and on a circle's page
  what the motion feat proposes about its powers, read by its
  `about` and made by its `putting`.
- `close` (ordered), replacing the motion feat's in the shell: the
  motion feat's `closing`, then `count`, in one transaction under one
  verdict; the guards of each slice judge it (`motion.closes`, `sits`,
  `counts`). What it passed, its admissions among them,
  `carried` writes in the same transaction.
- `carried(motion)`: in the transaction of a passing motion's close, after
  its `submit`, carries out its other actions in the order proposed, each
  an effect citing the close and the action's number (`cella.follow`),
  its actor the member who closed it, judged by its guards: an
  admission, the membership feat's `admitting` with core's `seating`,
  a refused seat refusing it; a suspension or an exclusion
  (membership feat),
  a circle created (core's `create`), a seat given or ended (core's
  `add` and `remove`), a role seated in a circle or unseated (core's
  `seatRole` and `unseatRole`), a policy
  adopted or ended, a mandate's with it (the motion feat's circles' `adopt` and
  `end`, which extend the motion feat's), whose request names the
  motion's action, `n`, so the writes that react to an adoption, a rule's
  terms, read the policy it is. A refused one is rolled back to its
  savepoint and forgone, and leaves the motion passed and that action
  undone, as its outcome says; the close commits with every effect,
  settled or forgone, or not at all. The slice runs it as its reaction to `motion:motion:close`.
  What reacts to an admission, the subscription, is an effect citing
  it that the admission requires: refused, under the statutes' minimum
  or into a closed month, it forgoes the admission and its seat with it,
  each recorded with its reason, and the close and the motion's other
  effects stand ([required
  effects](../../core/notary/index.md#required-effects)).
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
  a seat to the circle `motion.decider` finds holding `seat-member`, or the assembly. Admitting, suspending or ending a
  membership, and giving or ending a seat, elect or remove a person, so
  `put` names a secret ballot for each.

### Shell of the roll

Adds to a motion's page its roll: each person by name,
their latest stance received before the cutoff, whether the close counted them, the outcome
`membership_motion.passes` computes by the motion's procedure, how
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
member, or ending a seat held there, put to the circle that decides it; and
the motion feat's Propose…, whose write this graft serves.
