+++
title = "Motion"
updated = 2026-11-01
+++

How a circle acts as a whole: motions, proposed, voted on and closed, each carrying the actions it decides beyond its text, or none. A passed motion is a decision in plain speech; the code keeps no row and no name called decision. An outcome is computed from the signed votes, never claimed; each member's latest vote counts once.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/motion/propose` | confluent | a proposal is a fact |
| `POST /api/motion/vote` | confluent | signed by the member; their latest vote counts |
| `POST /api/motion/close` | ordered | the notary fixes which votes made the deadline |
| `POST /api/motion/post` | confluent | a message on its deliberation; messages add up in any order |

None needs a power; each declares the check that allows it. **propose**, **close** and **post** need a seat in the motion's circle (`check: 'seat'`), **vote** a place on its roll (`check: 'roll'`) and the stance being the actor's own. Seats and rolls are `circle-membership-motion`'s, which registers the guards: `circle_membership_motion.sits` on propose, close and post, `on_roll` on vote. Lanterne's assembly motions are put and closed by any of its ten members; coordination's by its five.

## Schema

`motion` (`core/sql/`):

- `motion.motion`: circle, title, method (`consent` or `majority`), the procedure it is decided by, whose method it keeps by a foreign key, its ballot (`open` or `secret`, [below](#ballots)), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took.
- `motion.procedure`: how a motion is decided: its method; for a majority, the share of the votes cast it needs, at least `share_num` in every `share_den` of those for and against, or none for more for than against; and its quorum, at least `quorum_num` in every `quorum_den` of those counted giving a stance; and its ballot, `open` or `secret`, which a motion proposed under it takes unless the proposal names the other. Consent, majority and two thirds are built in, by open ballot, and election, a majority by secret ballot; a co-op adds its own, as Lanterne's ordinary and extraordinary assemblies. A procedure a motion names is fixed (`motion.procedure_kept`); a circle's default names one, which `circle-motion` checks.
- `motion.vote`: a stance by receipt, the motion, the member's address and the day they give. Receipts order stances; only those received before the cutoff count. A stance is personal data of its member, of class `books`, so a secret one is logged by its commitment ([below](#ballots)); ten years after a former member's erasure, `cella vault sweep` redacts their stances to `redacted`, which counts as none given.

- `motion.message`: a motion's deliberation, by receipt: its author's address, the message it answers (one of the same motion, received before it), its text, the handles it mentions (`@amina`, or a whole address) and the documents it links (`[[internal-rules]]`), as the text gives them, and the day. A closed motion takes no message (`open_for_messages`). The handles and links are resolved and checked by `membership-motion` and `document-motion`; the text is the author's words and stays out of the log.
- `motion.carries`: the actions a motion can carry, each a kind registered by the graft that carries it out (`admit`, `suspend` and `exit` by `membership-motion`; `nest`, `grant` and `revoke` by `circle-motion`; `seat` and `unseat` by `circle-membership-motion`; `adopt` by `document-motion`), with the arguments its actions take as the New form asks for them: text, a number, or one of the choices a graft adds to the collection's `about` under the key the argument's `options` names. This feat knows no kind; it keeps the register, as it keeps `motion.cites`.
- `motion.action`: the actions a motion carries, numbered in the order proposed, each of a kind `motion.carries` lists, with its arguments as JSON. The kind's graft reads it and its guards check it.

Triggers keep a closed motion closed and refuse stances on it, and refuse an action once a stance is given or the motion closed, so no one consents to one thing and is counted for another, raising SQLSTATE `09000`. The app role may select, insert and update motions, select and insert votes as the policy on secret stances lets it, and select and insert actions; the guards role, `cella_guards`, may select them all.

Who may vote on a motion, its roll, is the `circle-membership-motion` graft's: the members seated in its circle when it was proposed.

### Ballots

A motion is decided by open or secret ballot, fixed as it is proposed: its procedure's, unless the proposal names the other. The built-in procedures a motion is put by are open, and `circle-membership-motion`'s Propose… and Appoint… name a secret ballot for electing or removing a person, as co-ops commonly do; a co-op's own procedure says which its motions take. `motion.secret(motion)` says whether one is secret.

- **Open**: a stance is logged as given, and every member reads every stance.
- **Secret**: the vote logs the stance as a salted commitment (`cella.personal` registers `motion.vote.stance`), and the vault keeps the stance under its member's key. The entry names its actor, as every entry does, so the log says that a member gave a stance and when, never which. In the read model, a row-level policy lets the app read a secret stance only as its own member's, or in a write's transaction; the guards role reads them all. How the roll and the tally show is `circle-membership-motion`'s: the tally sealed until the close, each member's stance never.

`motion.cites` lists the writes that cite a motion: each settles only once the motion its payload names has closed and passed. A graft that joins this feat to a write's feat declares the write's op there; the graft that counts the roll attaches its guard to every action listed. The app role and the guards role may select it.

## Guards

- `motion.proposes`, on `motion:motion:propose`: the write proposed the motion on the verdict date, open until a later deadline, with as many actions as its payload names. `motion.balloted`, on the same action: its ballot is the one the payload names. That each action applies is the guard of the graft registering its kind; that the actor sits in the circle, `circle-membership-motion`'s.
- `motion.closes`, on `motion:motion:close`: the write closed the motion on the verdict date, and not before its deadline. A motion closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.
- `motion.posts`, on `motion:message:post`: the message is the actor's own and names the motion, the message it answers, the mentions and the links its payload does. That each mention names one member is `membership-motion`'s guard, that each link names a document `document-motion`'s.
- `motion.own_stance`, on `motion:motion:vote`: the stance is the actor's own (`cella.actor()`); no member votes for another. `motion.seals`, on the same action: a stance on a secret ballot is logged by its commitment alone, one on an open ballot as given. That the actor is on the motion's roll is `circle-membership-motion`'s guard on the same action. A stance needs no power.

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent`, `cella.majority` or `cella.share` over the roll, by the motion's procedure and its quorum, as the `circle-membership-motion` graft does.

## Handlers

- `vote` (confluent): the member's own stance, with the write's receipt, `cella.receipt()`, which the notary signs; logged as a single-entry batch, the stance marked personal on a secret ballot. A stance for another member, off the roll or on a closed motion returns `Refused`, as the guards and the trigger judge it; the handler throws for none of them.
- `propose` (confluent): inserts the motion by the procedure it names, its method the procedure's and its ballot the one the proposal names or else the procedure's, numbered the year's next (`m-2026-013`) under a lock on the numbering, proposed on the verdict date, and its actions; circle-membership-motion's `propose` replaces it in the shell and fixes the roll in the same write, by `proposing`, the write this one makes. Submits `{ motion, circle, procedure, ballot, deadline, actions }`: the title and the text are the proposer's words and stay out of the log.
- `post` (confluent): the acting member's message, with the write's receipt, perhaps answering another; the form reads the handles it mentions and the documents it links from its text (`models/thread.ts`). Submits `{ motion, member, message, reply, mentions, links }`, without the text.
- `close` (ordered), and `closing`, the same as a write a graft extends in its transaction: sets the closed date to `cella.verdict_date()` and the cutoff to the close's own receipt, then submits. `circle-membership-motion` replaces it in the shell with a close that counts the roll and admits and seats in the same verdict; where that graft is mounted, this close alone counts no roll and its guard `counts` refuses it.

## Grafts

- `circle-membership-motion`, which this feat declares: a motion's roll, from the seats in its circle, and whether it passes on it.

## Shell

The `motions` collection, open ones first. Its New form proposes one:
the circle it is put in, from those `circle-motion` lists in the
collection's `about`; the procedure, its terms in words, a secret ballot among them, which follows
the circle's until another is chosen; the deadline, the title and the text; and the
actions it carries, each a kind from `motion.carries`, whose arguments the
form then asks for. A motion's page shows its proposal and each action it
carries, its arguments by its kind's labels, a member by name, every stance given as its activity, on a secret ballot the reader's own alone, and closes it (`close`).
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

Ported from seedling's `specs/feat/06-motions.md` under this repo's labels and grafts: proposals with the actions they carry, stances and the close. Amendments, delegation, a second call without a quorum and closing early once everyone has spoken are not built.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `motion.motions` and `motion.procedures` to the analytics shell: each motion, its procedure and its days. Stances are not shared: a secret ballot's roll is never shown, and an open one's is on the motion's page.
