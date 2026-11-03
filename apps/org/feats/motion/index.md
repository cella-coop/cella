+++
title = "Motion"
updated = 2026-11-03
+++

How a circle acts as a whole: motions, proposed, voted on and closed, each carrying the actions it decides beyond its text, or none. A passed motion is a decision in plain speech; the code keeps no row and no name called decision. An outcome is computed from the signed votes, never claimed; each member's latest vote counts once. Each action a passed motion carries is a write of its own once the close settles, signed by whoever closed it and judged by its own guards, and what follows it, such as the capital a departure moves, is the reaction of the graft that knows it ([trust](../../../../_corpus/doc/trust.md#three-kinds-of-action)). A motion may adopt a policy, a sentence its circle binds itself by, which the register in org's core keeps ([policies](../../../../_corpus/doc/architecture.md#policies)).

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/motion/propose` | confluent | a proposal is a fact |
| `POST /api/motion/vote` | confluent | signed by the member; their latest vote counts |
| `POST /api/motion/close` | ordered | the notary fixes which votes made the deadline |
| `POST /api/motion/post` | confluent | a message on its deliberation; messages add up in any order |
| `POST /api/motion/adopt` | ordered | a policy its motion carries binds from its verdict |
| `POST /api/motion/end` | ordered | a policy its motion ends binds no longer from its verdict |

**adopt** and **end** need the motion they cite to have passed and to carry the policy or its end, a protected policy they replace or end to be changed by a motion decided by the procedure it names or a stricter one ([protected policies](#protected-policies)), and the motion's circle to hold a collective mandate for `adopt-policy` or `end-policy`, the powers this feat registers with them by `motion.register_cite`, to which `circle-membership-motion` attaches its guard `carried` and `circle-motion` its guard `mandated`. **propose** and **close** need the participant's power `propose`, and **post** its `discuss`, each held in the motion's circle: every circle has a participant role, which every seat in it holds there ([circle](../circle/index.md#the-participant-role)); this feat registers the two in `cella.power`. **vote** needs `vote`, the power a motion's procedure gives the seats on its roll and no mandate grants, which this feat registers in `motion.stance_power`, and the stance being the actor's own. Seats and rolls are `circle-membership-motion`'s, which registers the guards: `circle_membership_motion.sits` on propose, close and post, holding the power to the motion's circle, `on_roll` on vote. Lanterne's assembly motions are put and closed by any of its ten members, by the participant's mandates the founding motion grants; coordination's by its five.

## Schema

`motion` (`core/sql/`):

- `motion.motion`: circle, title, method (`consent` or `majority`), the procedure it is decided by, which its requirements fix as it is proposed and never its proposal ([requirements](#requirements)), whose method it keeps by a foreign key, its ballot (`open` or `secret`, [below](#ballots)), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took.
- `motion.procedure`: how a motion is decided: its method; for a majority, the share of the votes cast it needs, at least `share_num` in every `share_den` of those for and against, or none for more for than against; and its quorum, at least `quorum_num` in every `quorum_den` of those counted giving a stance; and its ballot, `open` or `secret`, which a motion proposed under it takes unless the proposal names the other; the roles whose seats vote, `voters`, none for every seat, and those that may veto, `veto`, none where no one may; the circle it consults, `consult`, none where it consults none; and the procedure policy whose values it holds (`policy`, [below](#procedures)). Consent, majority and two thirds are built in, by open ballot, and election, a majority by secret ballot, each naming no policy until its scope adopts it; every other procedure is a policy's, as Lanterne's ordinary and extraordinary assemblies are. A procedure a motion is decided by is fixed (`motion.procedure_kept`), but for the policy a built-in one comes to name; a circle's procedure, by which its motions are decided where nothing asks another, names one, which `circle-motion` checks.
- `motion.vote`: a stance by receipt, the motion, the member's address and the day they give. Receipts order stances; only those received before the cutoff count. A stance is personal data of its member, of class `books`, so a secret one is logged by its commitment ([below](#ballots)); ten years after a former member's erasure, `cella vault sweep` redacts their stances to `redacted`, which counts as none given.

- `motion.message`: a motion's deliberation, by receipt: its author's address, the message it answers (one of the same motion, received before it), its text, the handles it mentions (`@amina`, or a whole address) and the documents it links (`[[internal-rules]]`), as the text gives them, and the day. A closed motion takes no message (`open_for_messages`). The handles and links are resolved and checked by `membership-motion` and `document-motion`; the text is the author's words and stays out of the log.
- `motion.carries`: the actions a motion can carry, each a kind the graft that carries it out registers by `motion.register_carries(action, label, fields, op, owner)` from its migration, with the action, `op`, that carries it out (`membership:member:admit` for `admit`) (`policy`, adopting a policy, and `end`, ending one, by this feat itself; `admit`, `suspend` and `exit` by `membership-motion`; `nest` by `circle-motion`; `seat` and `unseat` by `circle-membership-motion`; `adopt` by `document-motion`), with the arguments its actions take as the New form asks for them: text, a number, or one of the choices a graft adds to the collection's `about` under the key the argument's `options` names. This feat knows no kind but its own; it keeps the register, as it keeps `motion.cites`, and its register functions alone write either.
- `motion.action`: the actions a motion carries, numbered in the order proposed, each of a kind `motion.carries` lists, with its arguments as JSON. The kind's graft reads it and its guards check it.

Triggers keep a closed motion closed and refuse stances on it, and refuse an action once a stance is given or the motion closed, so no one consents to one thing and is counted for another, raising SQLSTATE `09000`. The app role may select, insert and update motions, select and insert votes as the policy on secret stances lets it, and select and insert actions; the guards role, `cella_guards`, may select them all.

Who may vote on a motion, its roll, is what its procedure says ([procedures](#procedures)), and fixing it is the `circle-membership-motion` graft's: by default the people seated in its circle on the day it was proposed, never an agent or a service. A seat above carries no vote below.

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
  that circle has said something on its deliberation, which they may,
  and `circle-motion` checks the circle is one as the policy is proposed
  ([consultation](../../grafts/circle-membership-motion/index.md#guards)).
- `label`, where not its name in words: how the New form and a motion's
  page call it, its first letter capitalised.

A procedure marks no other value. `motion.terms(marked)` reads the terms
from the values as written, by name, and says what is wrong with them;
`motion.fraction`, a share as written. The values are copied into
`motion.procedure` as the policy is adopted, in the same verdict
(`motion.procedure_from`): a new row by the name it marks, or the
built-in row of that name, which names no policy yet and whose terms it
repeats, now naming it. A motion is counted by those columns, never by
the sentence. A procedure's terms are fixed once a motion is put to it,
so a policy changing them names a new procedure and replaces the old
policy, which ends; a procedure whose policy has ended, or applies only
later, puts no motion.

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
by its circle's procedure where none asks one. This feat knows neither
mandates nor circles' procedures: `circle-motion`, which joins them,
finds the requirements (`circle_motion.required`) and refuses a
proposal decided by another (`circle_motion.requires`), and
`circle-membership-motion`'s `propose`, through which every proposal
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
- both call the same roll: every seat, or the seats in the same roles,
  those that vote and those that may veto;
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

A motion is decided by open or secret ballot, fixed as it is proposed: its procedure's, unless the proposal names the other. The built-in procedures a motion is put by are open, and `circle-membership-motion`'s Propose… and Appoint… name a secret ballot for electing or removing a person, as co-ops commonly do; a co-op's own procedure says which its motions take. `motion.secret(motion)` says whether one is secret.

- **Open**: a stance is logged as given, and every member reads every stance.
- **Secret**: the vote logs the stance as a salted commitment (`cella.personal` registers `motion.vote.stance`), and the vault keeps the stance under its member's key. The entry names its actor, as every entry does, so the log says that a member gave a stance and when, never which. In the read model, a row-level policy lets the app read a secret stance only as its own member's, or in a write's transaction; the guards role reads them all. How the roll and the tally show is `circle-membership-motion`'s: the tally sealed until the close, each member's stance never.

`motion.cites` lists the actions that cite a motion, each with the power a collective mandate of the motion's circle grants it: each settles only once the motion its payload names has closed and passed, and only where its circle holds that power. A graft that joins this feat to an action's feat registers it from its migration by `motion.register_cite(action, power, owner)`, and this feat registers its own adoption and ending of a policy, `motion:policy:adopt` with `adopt-policy` and `motion:policy:end` with `end-policy`, the same way. An action so listed is in no `cella.power`, so no seat's mandate allows it. A graft covers every action listed with its guard (`circle-membership-motion` that the motion passed on its roll, `circle-motion` that its circle holds the power): it registers the guard by `motion.register_cite_guard(fn, owner)`, kept in `motion.cite_guard`, which attaches it in `cella.guard` to every action listed so far, and `register_cite` attaches every guard so kept to the action it lists, so a guard covers the actions registered before it and after, and no graft puts a trigger on the register. A graft's migration calls these functions and never inserts into the registers itself; only a migration may call them. The app role and the guards role may select the registers.

## Guards

- `motion.proposes`, on `motion:motion:propose`: the write proposed the motion on the verdict date, open until a later deadline, with as many actions as its payload names. `motion.balloted`, on the same action: its ballot is the one the payload names. That each action applies is the guard of the graft registering its kind; that the actor sits in the circle, `circle-membership-motion`'s.
- `motion.closes`, on `motion:motion:close`: the write closed the motion on the verdict date, and not before its deadline. A motion closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.
- `motion.posts`, on `motion:message:post`: the message is the actor's own and names the motion, the message it answers, the mentions and the links its payload does. That each mention names one member is `membership-motion`'s guard, that each link names a document `document-motion`'s.
- `motion.own_stance`, on `motion:motion:vote`: the stance is the actor's own (`cella.actor()`); no member votes for another. `motion.seals`, on the same action: a stance on a secret ballot is logged by its commitment alone, one on an open ballot as given. That the actor holds `vote`, on the motion's roll with a seat that counts, is `circle-membership-motion`'s guard on the same action.
- `motion.asks`, on `motion:motion:propose`: each policy the motion would end or replace is one of its circle in force on the verdict date, and not protected from the motion (`motion.protection_flaw`, [protected policies](#protected-policies)); each policy the motion would adopt is a mandate, a right, a rule or a procedure, worded soundly for its kind (`policy.flaw`: each value marked once, with a value, and no stray brace, saying which way is stricter as `more is stricter` or `less is stricter` if at all, and only if it is an amount, a share, a day or a number; each such value of a rule saying it; a friendly wording marking none), its days written YYYY-MM-DD, applying no earlier than the motion's deadline and ending after it applies, and replacing, if it names one, a policy of the motion's circle and kind in force; protected, if it names a procedure, by one in force no looser than the motion's own; taking, if it names a default, one it is worded and protected as (`policy.takes_flaw`, [default policies](#default-policies)); and a procedure policy marks sound terms and names a procedure no policy has made, as `motion.procedure_flaw` reads them ([procedures](#procedures)).
- `motion.decides_by`, on `motion:motion:propose`: the procedure the motion is put to is built in, or its policy is in force on the verdict date.
- `motion.adopts`, on `motion:policy:adopt`: the policy the register keeps is the one the cited motion's action carries: named by that action, of the motion's circle and the action's kind, its wordings hashing as the action holds them (`policy.hash`; a guard reads no wording back), adopted on the verdict date and applying from the day the action names or the verdict date, whichever is later, until the day it names; the policy it replaces ends that day and is not protected from the motion; it is protected as the action names (`protected`) and takes the default it names (`takes`), worded as that default reads; the entry commits to its hash; and a procedure policy has made the procedure its values say, which names it in `motion.procedure`.
- `motion.ends`, on `motion:policy:end`: the policy the cited motion's action names ended on the verdict date, by that action, was the motion's circle's, and is not protected from the motion. That a mandate policy's mandate is copied or revoked with it is `circle-motion`'s guard on both actions.

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent`, `cella.majority` or `cella.share` over the roll, by the motion's procedure, its quorum and its vetoes, as the `circle-membership-motion` graft does.

## Handlers

- `vote` (confluent): the member's own stance, with the write's receipt, `cella.receipt()`, which the notary signs; logged as a single-entry batch, the stance marked personal on a secret ballot. A stance for another member, off the roll or on a closed motion returns `Refused`, as the guards and the trigger judge it; the handler throws for none of them.
- `propose` (confluent): inserts the motion by the procedure the write gives it, consent where it gives none, its method the procedure's and its ballot the one the proposal names or else the procedure's, numbered the year's next (`m-2026-013`) under a lock on the numbering, proposed on the verdict date, and its actions; circle-membership-motion's `propose` replaces it in the shell, gives it the procedure its requirements fix and fixes the roll in the same write, by `proposing`, the write this one makes. Submits `{ motion, circle, procedure, ballot, deadline, actions }`: the title and the text are the proposer's words and stay out of the log.
- `post` (confluent): the acting member's message, with the write's receipt, perhaps answering another; the form reads the handles it mentions and the documents it links from its text (`models/thread.ts`). Submits `{ motion, member, message, reply, mentions, links }`, without the text.
- `close` (ordered), and `closing`, the same as a write a graft extends in its transaction: sets the closed date to `cella.verdict_date()` and the cutoff to the close's own receipt, then submits. `circle-membership-motion` replaces it in the shell with a close that counts the roll and admits and seats in the same verdict; where that graft is mounted, this close alone counts no roll and its guard `counts` refuses it.
- `adopt` (ordered): adopts the policy a passed motion carries as its action `n`, through the register's `policy.adopt` (`adopting` in `@cella/org-policy`), in the motion's circle, from the day the action names or the verdict date, whichever is later, protected by the procedure the action names, if any, taking the default it names, if any, and copies a procedure policy's values into the procedure they make (`motion.procedure_from`). Submits `{ policy, motion, n, applies, hash }`, the hash of its wordings in hex. `circle-membership-motion` runs it for each policy a passing motion carries, as it carries out the motion's other actions. `adopting`, the same as a write a graft extends in its transaction, is what `circle-motion`'s `adopt` extends with the circle feat's copy of a mandate.
- `end` (ordered), and `ending`, the same as a write a graft extends: ends the policy a passed motion's action `n` names on the verdict date, through the register's `policy.end` (`ending` in `@cella/org-policy`). Submits `{ policy, motion, n, ends }`. `circle-membership-motion` runs `circle-motion`'s `end`, which extends it, for each policy a passing motion ends.

## Grafts

- `circle-membership-motion`, which this feat declares: a motion's roll, from the seats in its circle its procedure names, and whether it passes on it.

## Shell

The `motions` collection, open ones first. Its New form proposes one:
the circle it is put in, from those `circle-motion` lists in the
collection's `about`, and no procedure, since its requirements fix the one it is decided by, which its page shows; the deadline, the title and the text; and the
actions it carries, each a kind from `motion.carries`, whose arguments the
form then asks for: Adopt a policy asks for its kind, from the three this feat adds to the collection's `about` (`policyKinds`), its wording with each value marked `{name: value}`, perhaps its plain words, the days it applies from and until, the policy it replaces, from those not ended (`policies`), the procedure that alone changes it, from those in force (`protections`), and the default it takes, from the defaults of the forms the register offers (`defaults`); End a policy asks for the policy it ends, from the same list. A motion's page shows its proposal and each action it
carries, its arguments by its kind's labels, a member by name, the default a policy takes as its form names it, each default the motion leaves and by which of its actions, every stance given as its activity, on a secret ballot the reader's own alone, and closes it (`close`).
Its roll, its outcome and the stance form are `circle-membership-motion`'s;
the stance it posts is this feat's `vote`, for the acting member.

A motion's state is open, passed or rejected: open until its close,
then passed or rejected by the outcome of the stances the close froze.
The outcome is the graft's, so the state is too: `circle-membership-motion`
reads it in SQL and gives the collection its State column and its board.
This feat reads only whether and when a motion closed.

A motion's page has three tabs: Overview, the proposal in full under its
deadline, and what the grafts say is decided (whom it admits, the
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

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `motion.motions` and `motion.procedures` to the analytics shell: each motion, its procedure and its days. Stances are not shared: a secret ballot's roll is never shown, and an open one's is on the motion's page.
