+++
title = "Motion"
updated = 2026-11-07
+++

How a circle acts as a whole: motions, proposed, voted on and closed, each carrying the actions it decides beyond its text, or none. A passed motion is a decision in plain speech; the code keeps no row and no name called decision. An outcome is computed from the signed votes, never claimed; each member's latest vote counts once. Each action a passed motion carries is an effect in the close's transaction, citing it, its actor whoever closed it, judged by its own guards, and what follows it, such as the capital a departure moves, is the reaction of the graft that knows it ([trust](../../../../_corpus/doc/trust.md#three-kinds-of-action)). A motion may adopt a policy, a sentence its circle binds itself by, which the register in org's core keeps ([policies](../../../../_corpus/doc/architecture.md#policies)).

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/motion/propose` | confluent | a proposal is a fact |
| `POST /api/motion/vote` | confluent | signed by the member; their latest vote counts |
| `POST /api/motion/close` | ordered | the notary fixes which votes made the deadline |
| `POST /api/motion/post` | confluent | a message on its deliberation; messages add up in any order |
| `POST /api/motion/adopt` | ordered | a policy its motion carries binds from its verdict |
| `POST /api/motion/end` | ordered | a policy its motion ends binds no longer from its verdict |

**adopt** and **end** need the motion they cite to have passed and to carry the policy or its end, a protected policy they replace or end to be changed by a motion decided by the procedure it names or a stricter one ([protected policies](#protected-policies)), and the motion's circle to hold a collective mandate for `adopt-policy` or `end-policy`, the powers this feat registers with them by `motion.register_cite`, to which `membership-motion` attaches its guard `carried` and this feat its guard `mandated` ([circles](#circles)). **propose** and **close** need the participant's power `propose`, and **post** its `discuss`, each held in the motion's circle: every circle has a participant role, which every seat in it holds there ([circle](../../core/circle/index.md#the-participant-role)); this feat registers the two in `cella.power`. **vote** needs `vote`, the power a motion's procedure gives the seats on its roll and no mandate grants, which this feat registers in `motion.stance_power`, and the stance being the actor's own. Seats and rolls are `membership-motion`'s, which registers the guards: `membership_motion.sits` on propose, close and post, holding the power to the motion's circle, `on_roll` on vote. Lanterne's assembly motions are put and closed by any of its ten members, by the participant's mandates the founding motion grants; coordination's by its five.

## Schema

`motion` (`core/sql/`):

- `motion.motion`: circle, its author, title, method (`consent` or `majority`), the procedure it is decided by, which its requirements fix as it is proposed and never its proposal ([requirements](#requirements)), whose method it keeps by a foreign key, its ballot (`open` or `secret`, [below](#ballots)), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took. Its author is the grantee it is proposed as, by one key into core's `circle.grantee`, the key a procedure's party is too: its circle, acting jointly, or a role its proposer holds by a tenure on the day it is proposed, acting alone. A motion proposed as no one named is its circle's (`motion.authored_by`), and its author is fixed. The person who proposed it, its `proposer`, is the actor of its log entry, as for every write. Its title and its body are its proposer's words, personal data of class `profile` whose subject is the proposer: the log keeps their commitments and the vault their values, and erasing the proposer redacts them.
- `motion.procedure`: how a motion is decided: its method; for a majority, the share of the votes cast it needs, at least `share_num` in every `share_den` of those for and against, or none for more for than against; and its quorum, at least `quorum_num` in every `quorum_den` of those counted giving a stance; and its ballot, `open` or `secret`, which a motion proposed under it takes unless the proposal names the other; and the procedure policy whose values it holds (`policy`, [below](#procedures)). Who votes on a motion decided by it, who may veto it and who is consulted are its parties, in `motion.party`. Consent, majority and two thirds are built in, by open ballot, and election, a majority by secret ballot, each naming no policy until its scope adopts it; every other procedure is a policy's, as Lanterne's ordinary and extraordinary assemblies are. A procedure a motion is decided by is fixed (`motion.procedure_kept`), but for the policy a built-in one comes to name; a circle's procedure, by which its motions are decided where nothing asks another, names one, which this feat checks.
- `motion.party`: a procedure's parties, each a grantee by one key into core's `circle.grantee`, the key a mandate's recipient is too ([circle](../../core/circle/index.md#entities)), with its kind: `votes`, a role whose seats in the motion's circle vote, none for every seat; `vetoes`, a role whose seats on the roll may veto; `consulted`, the circle whose seats must have spoken on a motion before it closes. Only a procedure policy's adoption makes them, and they are fixed as its terms are (`motion.party_kept`); the built-in procedures have none.
- `motion.vote`: a stance by receipt, the motion, the member's address and the day they give. Receipts order stances; only those received before the cutoff count. A stance is personal data of its member, of class `books`, so a secret one is logged by its commitment ([below](#ballots)); ten years after a former member's erasure, `cella vault sweep` redacts their stances to `redacted`, which counts as none given.

- `motion.message`: a motion's deliberation, by receipt: its author's address, the message it answers (one of the same motion, received before it), its text, the handles it mentions (`@amina`, or a whole address) and the documents it links (`[[internal-rules]]`), and the day. The table generates the mentions and the links from the text (`motion.mentions`, `motion.links`), by the grammar `models/thread.ts` draws it with: a handle after a space or at the start, its trailing `._-` dropped, a link by its id, each lowered and each once, in the order given. So no row mentions or links what its text does not give, whatever its writer names. A closed motion takes no message (`open_for_messages`). The handles and links are resolved and checked by `membership-motion` and `document-motion`; the text is its member's words, personal data of class `profile`, which the log commits to and the vault keeps.
- `motion.carries`: the actions a motion can carry, each a kind the graft that carries it out registers by `motion.register_carries(action, label, fields, op, owner)` from its migration, with the action, `op`, that carries it out (`membership:member:admit` for `admit`) (`policy`, adopting a policy, and `end`, ending one, by this feat itself; `admit`, `suspend` and `exit` by `membership-motion`; `seat` and `unseat` by `membership-motion`; `adopt` by `document-motion`), with the arguments its actions take as the New form asks for them: text, a number, or one of the choices a graft adds to the collection's `about` under the key the argument's `options` names. This feat knows no kind but its own; it keeps the register, as it keeps `motion.cites`, and its register functions alone write either.
- `motion.action`: the actions a motion carries, numbered in the order proposed, each of a kind `motion.carries` lists, with its arguments as JSON. The kind's graft reads it and its guards check it.

Triggers keep a closed motion closed and refuse stances on it, and refuse an action once a stance is given or the motion closed, so no one consents to one thing and is counted for another, raising SQLSTATE `09000`. The app role may select, insert and update motions, select and insert votes as the policy on secret stances lets it, and select and insert actions; the guards role, `cella_guards`, may select them all.

Who may vote on a motion, its roll, is what its procedure says ([procedures](#procedures)), and fixing it is the `membership-motion` graft's: by default the people seated in its circle on the day it was proposed, never an agent or a service. A seat above carries no vote below.

- `motion.stance_power`: the power a stance needs, `vote`, on `motion:motion:vote`, which a procedure gives the seats on a motion's roll rather than a mandate; the feat's own row, as `cella.power` and `motion.cites` hold theirs, and what `cella check feats` reads the label against. The app role and the guards role may select it.

### Procedures

How a circle's motions are decided is a procedure policy, a sentence its
circle adopted by motion ([policies](../../../../_corpus/doc/architecture.md#policies)),
whose values are its terms, each marked once by its name:

```text
By the {label: extraordinary assembly}'s procedure, {procedure: extraordinary}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: 1/2} of those on its roll, by {ballot: open} ballot
```

- `procedure`: its name, lower-case letters and dashes, by which a motion
  is put to it and a circle defaults to it; a name no procedure has, or a
  built-in one whose terms the policy repeats.
- `method`: `consent` or `majority`.
- `quorum`: the share of those on the roll who must give a stance, as a
  fraction (`1/4`), a whole percent (`25 %`) or `none`.
- `share`, a majority's alone, where it needs more than more for than
  against: the share of the votes cast, written as the quorum is, more
  than none and at most all.
- `ballot`, where not `open`: `secret`.
- `voters`, where not every seat: the roles whose seats in the motion's circle vote, by id, separated by commas (`{voters: lead, secretary}`); `participant` is every seat.
- `veto`, where any: the roles whose seats on the roll may veto, written as `voters` is (`{veto: lead}`). A stance against, or an objection, from one of them is a veto: the motion does not pass, whatever the count. A veto role's seats are on the roll though `voters` does not name it.
- `consult`, where any: the circle a motion decided by it consults, by
  id (`{consult: coordination}`). It closes only once someone seated in
  that circle has said something on its deliberation, which they may
  ([consultation](../../grafts/membership-motion/index.md#guards)).
- `label`, where not its name in words: how the New form and a motion's
  page call it, its first letter capitalised.

A procedure marks no other value. Each role `voters` and `veto` name,
and the circle `consult` names, is a grantee, and is one party of the
procedure, by its id and its kind (`votes`, `vetoes`, `consulted`). A
party names a grantee there is, and of its kind: a role votes or
vetoes, and a circle is consulted. A policy naming one there is not, or
a circle to vote or a role to consult, is refused as it is proposed and
again as it is adopted, the reason naming the party and what it names,
as `no role clerk for a procedure's vetoes` or `coordination is a circle,
and a procedure's voters are roles` (`motion.party_flaw`).

`motion.terms(marked)` reads the terms from the values as written, by
name, and says what is wrong with them; `motion.fraction`, a share as
written; `motion.named`, the parties the values name, and `motion.parties`,
a procedure's own, in one order, so the two compare; `motion.calls`, the
roles whose seats its roll calls; `motion.votes`, whether a seat in a role
votes by it; and `motion.consults`, the circle it consults. The values are
copied into `motion.procedure`, and its parties into `motion.party`, as
the policy is adopted, in the same verdict (`motion.procedure_from`): a
new row by the name it marks, or the built-in row of that name, which
names no policy yet and whose terms it repeats, now naming it. A motion
is counted by those rows, never by the sentence. A procedure's terms are fixed once a motion is put to it,
so a policy changing them names a new procedure and replaces the old
policy, which ends; a procedure whose policy has ended, or applies only
later, puts no motion. A motion's page reads the terms it is decided by
from its procedure's row, by its name, whether or not its policy is in
force now or its reader reads the register, which is the members'
([circle](../../core/circle/index.md#who-reads-the-structure)): a seat
that is no member reads the motions of the circles it reads in, and the
terms they are decided by; the New form offers only the procedures it
reads in force.

Lanterne's six procedures are policies of the assembly, adopted by its
founding motion, `m-2021-001`, which the seed carries in.

### Requirements

A motion names no procedure: what it is decided by is its requirements,
never its proposal's choice
([policies](../../../../_corpus/doc/architecture.md#policies)). A
procedure rides on a mandate and passes down its chain, and each action
a motion carries acts under the collective mandate its circle holds for
the action's power; so its requirements are what those chains ask, and
the procedure protecting each policy it replaces or ends. It is decided
by the one of them as strict as all the others (`motion.as_strict`), or
by its circle's procedure where none asks one. This feat reads core's
mandates and circles' procedures: it finds the requirements (`motion.required`) and refuses a
proposal decided by another (`motion.requires`), and
`membership-motion`'s `propose`, through which every proposal
goes, puts the motion to the one they fix, whatever the proposal says.

### Protected policies

A policy may name the procedure by which alone it is replaced or ended,
its adoption's `protected` argument, which the register keeps
(`policy.policy.protected`,
[policies](../../../../_corpus/doc/architecture.md#policies)). A motion
that replaces or ends a protected policy has that procedure among its
requirements ([above](#requirements)), and is refused unless it is decided
by that procedure or a stricter one, and the refusal names the procedure
it needs (`motion.protection_flaw`): as it is proposed, by `motion.asks`,
and again as its action is carried out, by `motion.adopts` and
`motion.ends`.

`motion.as_strict(a, b)` says whether procedure `a` is at least as strict
as `b`, so that every count that passes by `a` passes by `b` too:

- both decide by the same method; consent and a majority count
  different stances, so neither is stricter than the other;
- both call the same roll: every seat, or the seats of the same
  parties, those that vote and those that may veto;
- `a`'s quorum is no lower;
- for a majority, `a` lets veto every role `b` does, and its share of
  the votes cast is no lower: more for than against is stricter than
  any share of a half or less, and looser than any of more than half;
- `a` consults the circle `b` consults, if `b` consults one.

A procedure is as strict as itself; the ballot changes no count. A
policy is protected by a procedure in force, built in or by a policy in
force, and never by one looser than the procedure its own motion is
decided by, which would protect it from nothing: a motion by the
extraordinary assembly protecting a policy by the ordinary is refused. A
procedure neither stricter nor looser, such as consent beside a
majority, may protect it.

Lanterne's founding motion adopts its rights, and the assembly's and
coordination's collective mandates to adopt and end policies and to give
and end seats, protected by the extraordinary assembly's procedure: a
motion of the assembly ending the members' right to draw on their
account is decided by the extraordinary assembly's procedure, whatever
its proposal names, and ends it once passed by it; a motion the motion
feat alone puts to the ordinary is refused.

### Default policies

A policy may take a default policy of a legal form, its adoption's
`takes` argument (`scop-sarl-fr:ordinary`), which the register keeps
(`policy.policy.takes`, [legal forms](../../../../_corpus/doc/forms.md)):
then its kind, wordings and protection are the default's, as it reads
now, and a motion that takes one worded or protected otherwise is
refused, saying which (`policy.takes_flaw`): as it is proposed, by
`motion.asks`, and again as its action is carried out, by
`motion.adopts`, which also holds the register's policy to the default
the action names. A motion leaves a default when it replaces the policy
taking it with one that takes none, or ends it; `policy.left_by(motion)`
lists what each motion left, as its page shows it.

Lanterne's founding motion takes the SCOP SARL's defaults: its six
procedures, the participant's mandates, the assembly's collective
mandates, its rights, and the law's floors on the work share and the
reserves; its role mandates, coordination's collective mandates and its
capital and work share terms are its own.

### Ballots

A motion is decided by open or secret ballot, fixed as it is proposed: its procedure's, unless the proposal names the other. The built-in procedures a motion is put by are open, and `membership-motion`'s Propose… and Appoint… name a secret ballot for electing or removing a person, as co-ops commonly do; a co-op's own procedure says which its motions take. `motion.secret(motion)` says whether one is secret.

- **Open**: a stance is logged as given, and every member reads every stance.
- **Secret**: the vote logs the stance as a salted commitment (`cella.personal` registers `motion.vote.stance`), and the vault keeps the stance under its member's key. The entry names its actor, as every entry does, so the log says that a member gave a stance and when, never which. In the read model, a row-level policy lets the app read a secret stance only as its own member's, or in a write's transaction; the guards role reads them all. How the roll and the tally show is `membership-motion`'s: the tally sealed until the close, each member's stance never.

`motion.cites` lists the actions that cite a motion, each with the power a collective mandate of the motion's circle grants it: each settles only once the motion its payload names has closed and passed, and only where its circle holds that power. A graft that joins this feat to an action's feat registers it from its migration by `motion.register_cite(action, power, owner)`, and this feat registers its own adoption and ending of a policy, `motion:policy:adopt` with `adopt-policy` and `motion:policy:end` with `end-policy`, the same way. An action so listed is in no `cella.power`, so no seat's mandate allows it. A graft covers every action listed with its guard (`membership-motion` that the motion passed on its roll, and this feat's own `mandated` that its circle holds the power): it registers the guard by `motion.register_cite_guard(fn, owner)`, kept in `motion.cite_guard`, which attaches it in `cella.guard` to every action listed so far, and `register_cite` attaches every guard so kept to the action it lists, so a guard covers the actions registered before it and after, and no graft puts a trigger on the register. A motion may also be put by an action of another feat's that proposes it in its own write, as `membership-motion`'s application does: the graft that composes it lists that action from its migration by `motion.register_put(action, owner)`, kept in `motion.puts`. A graft judging what a motion asks, however it is put, registers its guard by `motion.register_ask_guard(fn, owner)`, kept in `motion.ask_guard`, which attaches it in `cella.guard` to `motion:motion:propose` and to every action listed in `motion.puts` so far, and `register_put` attaches every guard so kept to the action it lists; so `account-motion`'s check of an admission's capital terms judges an application as it judges a proposal, and neither graft knows the other. Such a guard reads the motion its payload's `motion` names, as both actions' payloads carry it, and judges only what the motion asks. A graft's migration calls these functions and never inserts into the registers itself; only a migration may call them. The app role and the guards role may select the registers.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`motion.motion.circle` is the circle that decides; its stances, actions
and messages are in its circle, which `motion.in_its_circle` copies into
each as it is made. `motion.cites`, `motion.cite_guard`,
`motion.puts`, `motion.ask_guard`, `motion.stance_power`, `motion.carries` and `motion.procedure` are
registries and name none.

## Guards

- `motion.proposes`, on `motion:motion:propose`: the write proposed the motion on the verdict date, open until a later deadline, with as many actions as its payload names. `motion.balloted`, on the same action: its ballot is the one the payload names. That each action applies is the guard of the graft registering its kind; that the actor sits in the circle, `membership-motion`'s.
- `motion.closes`, on `motion:motion:close`: the write closed the motion on the verdict date, and not before its deadline. A motion closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.
- `motion.posts`, on `motion:message:post`: the message is the actor's own and names the motion, the message it answers, the mentions and the links its payload does, which are its text's, since the table generates them. That each mention names one member is `membership-motion`'s guard, that each link names a document `document-motion`'s.
- `motion.own_stance`, on `motion:motion:vote`: the stance is the actor's own (`cella.actor()`); no member votes for another. `motion.seals`, on the same action: a stance on a secret ballot is logged by its commitment alone, one on an open ballot as given. That the actor holds `vote`, on the motion's roll with a seat that counts, is `membership-motion`'s guard on the same action.
- `motion.asks`, on `motion:motion:propose`: each policy the motion would end is one of its circle in force on the verdict date, and each it would replace one of its circle and kind in force on the day the new one would apply were the motion closed at its deadline, its `from` or else the deadline, and replaced by no other policy, so a policy that one still to apply replaces already is refused, the reason naming that one and the day it applies, the one to replace instead; each is not protected from the motion (`motion.protection_flaw`, [protected policies](#protected-policies)); each policy the motion would adopt is a mandate, a right, a rule or a procedure, worded soundly for its kind (`policy.flaw`: each value marked once, with a value, and no stray brace, saying which way is stricter as `more is stricter` or `less is stricter` if at all, and only if it is an amount, a share, a day or a number; each such value of a rule saying it; a friendly wording marking none), its days written YYYY-MM-DD, applying no earlier than the motion's deadline and ending after the day it would apply were the motion closed at its deadline, its `from` or else the deadline, so an `until` on that day is refused as one before it is; protected, if it names a procedure, by one in force no looser than the motion's own; taking, if it names a default, one it is worded and protected as (`policy.takes_flaw`, [default policies](#default-policies)); and a procedure policy marks sound terms and names a procedure no policy has made, as `motion.procedure_flaw` reads them ([procedures](#procedures)).
- `motion.authored`, on `motion:motion:propose`: the motion's author is the one its payload names, and is its own circle or a role its proposer holds by a tenure on the verdict date (`circle.tenure`, read on `cella.verdict_date()`). A proposal as another circle, or as a role no tenure of its proposer's runs that day, is refused naming the role, the day and what would fix it, as `the clerk role is held by no tenure of the proposer's on 2026-11-07: propose as ag, or as a role held that day`, and never the person. Who votes on a motion a role authors is its procedure's parties, as on any other ([procedures](#procedures)).
- `motion.decides_by`, on `motion:motion:propose`: the procedure the motion is put to is built in, or its policy is in force on the verdict date.
- `motion.adopts`, on `motion:policy:adopt`: the policy the register keeps is the one the cited motion's action carries: named by that action, of the motion's circle and the action's kind, its wordings hashing as the action holds them (`policy.hash`; a guard reads no wording back), adopted on the verdict date and applying from the day the action names or the verdict date, whichever is later, until the day it names, which is after that: a motion closed so late that its `until` falls on or before the day the policy would apply adopts nothing, and its action is refused with that reason, as a guard refuses any carried action, while the close stands; the policy it replaces is in force that day and replaced by no other, since another motion may have replaced it while this one was open, or the action is refused the same way, the reason naming the policy that replaces it and the day it applies, never broken by the register's unique `replaces` or by `policy.adopt`'s exception; it ends that day and is not protected from the motion; it is protected as the action names (`protected`) and takes the default it names (`takes`), worded as that default reads; the entry commits to its hash; and a procedure policy has made the procedure its values say, which names it in `motion.procedure`.
- `motion.ends`, on `motion:policy:end`: the policy the cited motion's action names ended on the verdict date, by that action, was the motion's circle's, and is not protected from the motion. That a mandate policy's mandate is copied or revoked with it is core's circles' guard on both actions, which this feat attaches ([circles](#circles)).

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent`, `cella.majority` or `cella.share` over the roll, by the motion's procedure, its quorum and its vetoes, as the `membership-motion` graft does.

## Folds

Every action that writes the feat's schema says how its entry applies to the state before it (`sql/013-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)), at version 1: a stance inserts the
stance by the receipt its entry carries, on the entry's day, as its
commitment where the ballot is secret; a close sets the closed day to
the entry's and the cutoff to the receipt it carries; an adoption runs
`policy.adopt` on the action's terms as the folded motion holds them,
from the day the entry says it applies, and the procedure it makes, and
refuses a policy or a hash other than the entry's; an end runs
`policy.end` and refuses a day other than the entry's. A proposal inserts the motion its
payload names by its procedure, on the entry's day, its proposer the
entry's actor, its title and text as their commitments, and its actions
in the order listed (`motion.fold_proposal`, which membership-motion's
application folds by too); a message inserts the message by the receipt
its entry carries, on its day, its text as its commitment.

## Handlers

- `vote` (confluent): the member's own stance, with the write's receipt, `cella.receipt()`, which the notary signs; logged as a single-entry batch, the stance marked personal on a secret ballot. A stance for another member, off the roll or on a closed motion returns `Refused`, as the guards and the trigger judge it; the handler throws for none of them.
- `propose` (confluent): inserts the motion as its author, the role the proposal names (`author`) or else its circle, by the procedure the write gives it, consent where it gives none, its method the procedure's and its ballot the one the proposal names or else the procedure's, numbered the year's next (`m-2026-013`) under a lock on the numbering, proposed on the verdict date, and its actions; membership-motion's `propose` replaces it in the shell, gives it the procedure its requirements fix and fixes the roll in the same write, by `proposing`, the write this one makes. Submits `{ motion, circle, author, procedure, ballot, deadline, title, body, actions }`, the title and the text marked personal, the proposer's words, so the log keeps their commitments.
- `post` (confluent): the acting member's message, with the write's receipt, perhaps answering another. It inserts the text, the row answers the handles it mentions and the documents it links, and it submits `{ motion, member, message, reply, body, mentions, links }`, those the row's, the text marked personal, so the log keeps its commitment. It signs the request's fields it reads, its motion, member, reply and text, so a request naming mentions or links of its own names nothing.
- `close` (ordered), and `closing`, the same as a write a graft extends in its transaction: sets the closed date to `cella.verdict_date()` and the cutoff to the close's own receipt, then submits `{ motion, closed, cutoff }`. `membership-motion` replaces it in the shell with a close that counts the roll and carries what the motion passed as its effects, in the same transaction; where that graft is mounted, this close alone counts no roll and its guard `counts` refuses it.
- `adopt` (ordered): adopts the policy a passed motion carries as its action `n`, through the register's `policy.adopt` (`adopting` in `@cella/org-policy`), in the motion's circle, from the day the action names or the verdict date, whichever is later, protected by the procedure the action names, if any, taking the default it names, if any, and copies a procedure policy's values into the procedure they make (`motion.procedure_from`). It first asks `motion.replacement_flaw`, the SQL `motion.adopts` judges by, whether the policy the action replaces is still its to replace; where another motion replaced it while this one was open, it writes nothing to the register, and the guard refuses the action with that reason. Submits `{ policy, motion, n, applies, hash }`, the hash of its wordings in hex. `membership-motion` runs it for each policy a passing motion carries, as it carries out the motion's other actions. `adopting`, the same as a write a graft extends in its transaction, is what this feat's circles' `adopt` extends with core's copy of a mandate.
- `end` (ordered), and `ending`, the same as a write a graft extends: ends the policy a passed motion's action `n` names on the verdict date, through the register's `policy.end` (`ending` in `@cella/org-policy`). Submits `{ policy, motion, n, ends }`. `membership-motion` runs the circles' `end`, which extends it, for each policy a passing motion ends.

## Circles

The circles' powers, by motion: the mandates core's circles and roles
hold, each a policy a circle adopts and ends
([mandates](../../core/circle/index.md#mandates)), and whom a circle's
motion decides about (`010-circle.sql` to `012-requirements.sql`, and
in the shell `motion/circles`, `api/circles.ts` and `app/circles.ts`).
Who sits where needs members as well, so seats by motion are
`membership-motion`'s, which builds on this feat.

It holds no table of its own for them: the actions are `motion.action`,
of this feat's own kinds, `policy` and `end`.
`motion.circle_action` reads them with the circle each is about: for a
mandate policy, the circle of the role it marks, or the circle it marks
for a collective mandate; for an end, the circle of the ended policy's
mandate. A role every working circle has (`*`) is the assembly's, and
so is a right. It reads as its reader, so it shows the actions of the motions its reader reads.

### Guards of the circles

- `motion.decides(decider, subject)`: a motion of `decider` may
  decide about `subject`, never by where either sits, since circles
  never nest: the assembly about every circle, and any other circle
  about every circle but itself and the assembly. A circle does not
  decide its own seats or powers; another does.
- `motion.decider(subject, powers, day, grant)`: the circle a proposal
  about `subject` is put to, which `putting` and
  `membership-motion` ask: a circle other than the assembly that
  may decide about it and holds, on the day, a collective mandate for
  every power in `powers`, the first by id, or else the assembly. For a
  grant, `powers` is `adopt-policy` and the power granted, `grant` its
  values (its power, limit and budget in cents, period and scope), and the
  circle's mandate for the power granted is one the grant is no wider
  than (`circle.wider`), so a grant is put only to a circle that may
  issue it under a mandate of its own and `circle.narrows` never
  refuses it for its issuer: a circle holding `adopt-policy` alone, or
  a mandate for the power narrower than the grant, is passed over for
  the next, and where none is left the assembly decides it.
- `motion.grant_flaw(issuer, wording, from, until)`: what is wrong with
  a mandate policy of that wording a motion of `issuer` would adopt,
  applying from and until those days, as the field a form names it under
  and why, or nothing, which `putting` asks before it proposes a grant
  or a change: its values are unsound (`circle.mandate_flaw`, under the
  field it is about); the issuer may not decide about its grantee's
  circle (`motion.decides`); or the issuer, not the assembly, holds no
  mandate for the power standing that day to issue it under, or none it
  is no wider than (`circle.parent_for`, `circle.wider`), the reason
  naming the parent and how the grant is wider, and saying to narrow it
  or put it to the assembly. Each reason names no one. Its values are
  read from the wording's marks by `motion.granting`, as the copy reads
  them, never from its words.
- `motion.issues(motion)`: what each action of a motion does to the
  mandates, which its page shows: for a mandate policy, the mandate it
  granted and its parent once closed, or while open the parent it would
  be issued under were it closed at its deadline and what
  `motion.grant_flaw` finds wrong with it; for the end or replacement of
  a mandate's policy, that mandate and every mandate below it its close
  revokes (`circle.under`), those standing on the day it ends while
  open, those revoked that day once closed.
- `motion.circle_asks`, on `motion:motion:propose`: each mandate policy
  marks sound values (`circle.mandate_flaw`: a role or a circle, a
  power in lower case, a cap by limit or by budget per month or year,
  never both, perhaps a procedure, perhaps a scope, and nothing else), a
  mandate's procedure is one the motion feat holds, and the motion's circle may
  decide it: about the role's circle or the circle a collective mandate
  is on; and the end of a mandate's policy is put to a circle on its
  chain as an issuer (`circle.chain`), the one that issued it or one
  that issued a mandate it is issued under, the assembly on every chain.
  A rule marking open books' disclosure values, or the parts of the
  structure it publishes, is the assembly's and marks them soundly
  (`circle.disclosure_flaw`, `circle.publication_flaw`), and, since one
  of each stands at a time, replaces the one in force on days its own
  meet, which the refusal names, and is the motion's only one of its
  kind on those days (`circle.overlap_flaw`, `motion.standing_rules`).
  And the policies the motion adopts, replaces and ends leave the
  assembly, once it is carried out, a collective `adopt-policy` mandate
  in force on the verdict date with no `until` (`circle.sovereignty`),
  judged at each action that ends or replaces one with the actions
  before it: a motion ending the last is refused at its proposal, and
  so is one adopting in its place one that applies only from a later
  day, while one adopting another in force in its place first passes.
- `motion.empowers`, on `motion:motion:propose`: the motion's
  circle holds, on the verdict date, a collective mandate
  (`circle.holds`) for the power of every action the motion carries:
  the power `motion.cites` lists for the action that carries out its
  kind (`motion.carries.op`). A motion of Web admitting a member is
  refused at its proposal, since Web holds no `admit-member`.
- `motion.mandated`, on every action in `motion.cites`: the cited
  motion's circle holds, on the verdict date, a collective mandate for
  the power `motion.cites` lists for the action, so a mandate revoked
  between the proposal and the close carries nothing. This feat
  registers it by `motion.register_cite_guard`, beside
  `membership-motion`'s `carried`. An admission settles inside
  the close, under the close's guards, so `empowers` checks it at the
  proposal alone.
- `motion.required(circle, actions, day)`: the procedure a motion
  of `circle` carrying `actions` is decided by, its requirements
  ([policies](../../../../_corpus/doc/architecture.md#policies)): for
  each action, what the chain of the collective mandate its circle holds
  for the action's power on the day asks (`motion.asks_of`, the
  nearest procedure stated on `circle.chain`), the first standing by id;
  and for each policy it replaces or ends, the procedure protecting it.
  It is the one of them as strict as all the others, or the circle's
  procedure where none asks one, or none where no one meets them all.
  `motion.requirements` lists them, each with why it is asked.
- `motion.requires`, on `motion:motion:propose`: the motion is
  decided by what `required` fixes on the verdict date, so a proposal
  naming another, or whose requirements no one procedure meets, is
  refused saying what they ask.
- On `motion:policy:adopt` and `motion:policy:end`, core's circles'
  guards, which this feat attaches, its adoption and ending being the
  writes that grant and revoke a mandate:
  `circle.grants` that a mandate policy adopted has its mandate as its
  values say, `circle.revokes` that one ended has its mandate revoked,
  with every mandate issued under it,
  and `circle.narrows` on both that every mandate standing is a root
  the assembly issued or is issued under a parent its issuer holds,
  and is narrower than it, and `circle.sovereign` on both that the
  assembly still keeps a collective `adopt-policy` mandate in force
  on the verdict date with no `until`. So a motion of coordination grants a
  working circle's role a mandate only under one coordination holds for
  the power, within its cap and its term. And `motion.passes_down`
  on adoption, as the feat that knows both mandates and procedures:
  a mandate adopted stating a procedure states one at least as strict
  (`motion.as_strict`) as what its parent's chain asks, so a procedure
  passes down the chain and no mandate issued under it loosens it.

No write sets a circle's procedure: the seed carries it in, and the
fixture check holds it to a procedure the motion feat holds, built in or
made by a procedure policy the fixture's motions carry. A write
that sets one will be judged by a guard of this feat's on its action, not by
a trigger on core's table
([writes stay home](../../../../_corpus/doc/architecture.md#writes-stay-home)).

### Handlers of the circles

- `adopt` and `end` (ordered): the motion feat's `adopting` and
  `ending`, extended in their one transaction under one verdict by
  core's `granting` and `revoking`, so a mandate policy's values
  are copied into its mandate as it is adopted, and its mandate revoked
  as it ends, with every mandate issued under it, by the policy's own
  write. They submit the motion feat's payload with the mandate, or none
  for a policy of another kind, and `revoked`, every mandate the write
  revoked, the one ended or replaced first, so the log says each.
  `membership-motion` carries out every policy a passing motion
  adopts or ends through them.
- `putting`: the proposal a motion about a circle (`about`, read from
  its page's form) makes, to the circle that decides it, naming no
  procedure, since `membership-motion`'s `propose` gives it the
  one its requirements fix: for a grant, the issuer it names, or else
  the circle `decider` finds holding `adopt-policy` and a mandate for
  the power granted that the grant is no wider than, the one it issues
  the grant under, or else the assembly; titled with what it decides.
  Granting a mandate is proposing its policy, from and until the days it
  names, its legal wording made from the role or the circle, the power,
  what it grants in words, its cap and its scope, each value marked
  (`The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 3 000 €} a write`;
  `…, in its {scope: own} circle`; `The {circle: coordination} circle holds {power: send-quote}, to …, by motion, up to …`);
  changing one is proposing a policy of those values replacing its own,
  and revoking one is proposing to end its policy, each put to the
  circle that adopted it, since a policy is replaced and ended by its
  own circle: a mandate the assembly adopted is the assembly's to
  change or end. A grant or a change `motion.grant_flaw` finds wrong is
  refused before anything is proposed, its reason after the label of the
  field it names. Setting open books'
  disclosure values is proposing the assembly's disclosure rule, its
  legal wording Lanterne's with the three values marked as core reads
  them ([open books](../../core/circle/index.md#open-books)), replacing
  the rule in force, if any; withholding is proposing to end the rule in
  force, so no total of members' own figures is shared beyond each
  reader's own rights. Both are put to the assembly, whose rule it is;
  the values are judged by `circle.disclosure_flaw` as the motion is
  proposed, never here. A withholding ends the disclosure rule in force
  on the verdict date and nothing else: one naming any other policy,
  put on another circle's page, or put where no rule stands is refused
  before anything is proposed, by `motion.withhold_flaw`, its reason
  naming the rule in force to name instead. It writes nothing: the circle
  page's `put` is `membership-motion`'s, which proposes it and
  fixes its roll in one write, as only the graft holding the roll can.
  The writes that carry a passing motion out are
  `membership-motion`'s reaction to its close.

### The circles in the shell

Adds to the motions collection's `about` the circles a motion may be
put in, which the motion feat's New form offers.
On a circle's page, which circle decides about it, the open motions
about it, and Propose…: granting a mandate to one of its roles or to
it, changing one of its mandates or revoking one, with a deadline and
why, posted to the `put` membership-motion serves (below, under
Shell); and its Policies,
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

On the assembly's page, Open books is where the co-op configures what
it shares with every member of the totals of members' own figures,
their pay, time, capital, work share and expenses (`disclosure`, read
from `circle.disclosed` on the verdict date). It says whether a
disclosure rule stands, since when and by which motion, linked, and
shows one row per setting the
[disclosure study](../../../../_corpus/review/2026-11-05/disclosure.md)
recommends: whether such totals are shared at all, off unless a rule
stands; the fewest people a total may count, 5 by default, from 2 to
200; the most of a total one person may put in, 50 % by default, from
20 % to 100 %; and the most two may, 80 % by default, from 40 % to
100 %. Each row gives the value in force and the value proposed, and
beside the value proposed the study's plain words on whether it
exposes personal data and why, marked as it is typed, before anything
is proposed (`exposure`, in the feat's `models/disclosure.ts`):
**Exposes personal data** where a member can work out another's figure
from the totals alone (sharing on, two people, a check turned off at
100 %), **Weaker than the default** where it hides fewer totals than
the study recommends (three or four people, a share above the
default), and **A precaution, not a promise** for the default or
stricter; no value is called safe or anonymous. Its last row is the
rule no value turns off: the port withholds within each report, so no
withheld cell is had by subtraction there, but checks no report against
another view or period, so a member may still subtract one shared total
from another, or use what they know outside the books. Below, its form proposes the three values as a
motion of the assembly, with a deadline and why, prefilled with those
in force or else the defaults, posted to the `put` membership-motion
serves as `disclose`; and where a rule stands, a second proposes
ending it, `withhold`, which ends that rule and nothing else. A
refusal, a value outside its range among them, or a withholding that
names another policy, is put on another circle's page or finds no rule
standing, is the SQL's, saying what would fix it. No other circle's
page shows Open books.

## Grafts

- `membership-motion`, which this feat declares: a motion's roll, from the seats in its circle its procedure names, and whether it passes on it.

## Shell

The `motions` collection, open ones first. Its New form proposes one:
the circle it is put in, from those its circles' part lists in the
collection's `about`, and no procedure, since its requirements fix the one it is decided by, which its page shows; the deadline, the title and the text; and the
actions it carries, each a kind from `motion.carries`, whose arguments the
form then asks for: Adopt a policy asks for its kind, from the three this feat adds to the collection's `about` (`policyKinds`), its wording with each value marked `{name: value}`, perhaps its plain words, the days it applies from and until, the policy it replaces, from those not ended (`policies`), the procedure that alone changes it, from those in force (`protections`), and the default it takes, from the defaults of the forms the register offers (`defaults`); End a policy asks for the policy it ends, from the same list. A motion's page shows its proposal and each action it
carries, its arguments by its kind's labels, a member by name, the default a policy takes as its form names it, each default the motion leaves and by which of its actions, every stance given as its activity, on a secret ballot the reader's own alone, and closes it (`close`).
Once closed, it shows under the close each effect the close's
transaction wrote, as the log keeps them (`effects`, read with the
motion): every entry after the close's own and before the next
decision's, since a write's entries are consecutive, in the order
logged, each by its kind's label where `motion.carries` registers its
op and by its op where none does, settled or forgone, and the entry it
follows, the close or an earlier effect. A forgone one is marked so,
with the reason its entry keeps, which `cella.disclosed` opens to its
reader as it opens any entry: the closer, whom every effect acts as,
reads it; so does the person every commitment of the close's receipt,
which an effect's commitments are, is about, and so every reader of a
close that commits to no one's personal data; and so does a holder of
its action's power. To anyone else the page says the reason is not
disclosed to them. No kind a motion carries, and nothing that follows
one, commits to anyone's personal data, so every member reads every
forgone effect's reason, which names no one. So an admission forgone with the subscription
it requires shows forgone, its reason naming the refusal it follows,
over the subscription, forgone with its own reason, the statutes'
minimum and the shares asked. The outcome the close's post returns
holds the same; the page reads them from the log, so they stand once
the outcome is dismissed, for every later reader.
Its roll, its outcome and the stance form are `membership-motion`'s;
the stance it posts is this feat's `vote`, for the acting member.

A mandate is granted, changed and revoked from where it is read, by a
motion this feat proposes from the circle's page, its Propose… form
posted to the `put` membership-motion serves. Grant a mandate asks for
its grantee, a role of the circle or the circle itself, by motion; a
power and what it grants in words; perhaps a limit per write or a
budget and its period; perhaps a scope; perhaps the days it applies
from and until; and the circle whose motion issues it, the assembly or
another that may decide about the circle and holds `adopt-policy` by
motion (`issuers`), or else the first that holds a mandate to issue it
under, or the assembly (`motion.decider`). The form writes the mandate
policy's sentence with its values marked (`worded`, in the feat's
`models/circles.ts`), shows it as it will read as it is typed, and
proposes a motion of the issuer carrying Adopt a policy, its procedure
the one its requirements fix. Change one of its mandates is the same
form filled with the chosen mandate's values, proposing a policy that
replaces its own, a motion of the circle that issued it, whose policy
it is; Revoke one of its mandates proposes ending its policy, a motion
of that circle too. Replacing or ending a mandate's policy revokes every
mandate issued under it the same day, and the form says so. Before
anything is proposed, a grant or a change is judged by
`motion.grant_flaw(issuer, wording, from, until)`, from the day it would
apply, the deadline unless it names one: its values as core holds them
sound (`circle.mandate_flaw`), its issuer one that may decide about the
grantee's circle (`motion.decides`), and, for an issuer other than the
assembly, a mandate it holds for the power standing that day that the
grant is no wider than, found by the SQL that finds its parent as it is
adopted (`circle.parent_for`, `circle.wider`). A refusal is the write's
outcome, the label of the field it is about first, then what is wrong,
with the values it read, and what would fix it: a cap wider than the
parent's names the limit, the parent mandate and both caps; no mandate
to issue under names the issuer and the power. A motion's page shows,
under Mandates, what its actions do to the mandates (`motion.issues`):
for each grant, the parent it would be issued under were it closed at
its deadline, and what `motion.grant_flaw` finds wrong with it as it
stands, or once closed the mandate it granted and its parent; for each
end or replacement of a mandate's policy, that mandate and every one
below it its close revokes the same day (`circle.under`), or once
closed those it revoked; each by its power, grantee, cap and issuer,
linking to the page of the circle that lists it.

A motion's state is open, passed or rejected: open until its close,
then passed or rejected by the outcome of the stances the close froze.
The outcome is the graft's, so the state is too: `membership-motion`
reads it in SQL and gives the collection its State column and its board.
Of its outcome, this feat reads only whether and when a motion closed.

A motion's page has three tabs: Overview, the proposal in full under its
deadline, once closed the effects its close carried, and what the grafts
say is decided (whom it admits, the
version it adopts, the outcome); Stances, the roll and the acting
member's stance; and Discussion, its deliberation, each message under
the one it answers, a mention drawn by `membership-motion`'s `member` embed
and a link by `document-motion`'s `document` embed, and while it is
open a message as the acting member, or a reply to the one chosen. The stances given in time order stay in the drawer's
Activity card, their one home.

A motion drawn elsewhere is one card, the feat's `Card` (`./app`):
its title, circle, method and where it stands, linking to its page, over
the motions `summaries` (`./api`) reads. `document-motion` embeds
it in documents, `meeting-motion` in a meeting's minutes.

## Domain

Ported from seedling's `specs/feat/06-motions.md` under this repo's labels and grafts: proposals with the actions they carry, stances and the close. Amendments, delegates, which a procedure would configure, a second call without a quorum and closing early once everyone has spoken are not built.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `motion.motions` and `motion.procedures` to the analytics shell: each motion, its procedure and its days. Stances are not shared: a secret ballot's roll is never shown, and an open one's is on the motion's page. `motion.motions` is scoped by `circle`, the circle that owns the motion, and `motion.procedures` is shared by `id`, as the legal form's.
