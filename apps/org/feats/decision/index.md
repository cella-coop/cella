+++
title = "Decision"
updated = 2026-11-01
+++

Proposals, votes and outcomes. An outcome is computed from the signed votes, never claimed; each member's latest vote counts once.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/decision/propose` | confluent | a proposal is a fact |
| `POST /api/decision/vote` | confluent | signed by the member; their latest vote counts |
| `POST /api/decision/close` | ordered | the notary fixes which votes made the deadline |
| `POST /api/decision/post` | confluent | a message on its deliberation; messages add up in any order |

None needs a power; each declares the check that allows it. **propose**, **close** and **post** need a seat in the decision's circle (`check: 'seat'`), **vote** a place on its roll (`check: 'roll'`) and the stance being the actor's own. Seats and rolls are `circle-decision-membership`'s, which registers the guards: `circle_decision_membership.sits` on propose, close and post, `on_roll` on vote. Lanterne's assembly decisions are put and closed by any of its ten members; coordination's by its five.

## Schema

`decision` (`core/sql/`):

- `decision.decision`: circle, title, rule (`consent` or `majority`), the procedure it is taken by, whose rule it keeps by a foreign key, its ballot (`open` or `secret`, [below](#ballots)), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took.
- `decision.procedure`: how a decision is taken: its rule; for a majority, the share of the votes cast it needs, at least `share_num` in every `share_den` of those for and against, or none for more for than against; and its quorum, at least `quorum_num` in every `quorum_den` of those counted giving a stance; and its ballot, `open` or `secret`, which a decision proposed under it takes unless the proposal names the other. Consent, majority and two thirds are built in, by open ballot, and election, a majority by secret ballot; a co-op adds its own, as Lanterne's ordinary and extraordinary assemblies. A procedure a decision names is fixed (`decision.procedure_kept`); a circle's default names one, which `circle-decision` checks.
- `decision.vote`: a stance by receipt, the decision, the member's address and the day they give. Receipts order stances; only those received before the cutoff count. A stance is personal data of its member, of class `books`, so a secret one is logged by its commitment ([below](#ballots)); ten years after a former member's erasure, `cella vault sweep` redacts their stances to `redacted`, which counts as none given.

- `decision.message`: a decision's deliberation, by receipt: its author's address, the message it answers (one of the same decision, received before it), its text, the handles it mentions (`@amina`, or a whole address) and the documents it links (`[[internal-rules]]`), as the text gives them, and the day. A closed decision takes no message (`open_for_messages`). The handles and links are resolved and checked by `decision-membership` and `decision-document`; the text is the author's words and stays out of the log.
- `decision.kind`: the kinds of thing a decision can decide beyond its text, each registered by the graft that carries it out (`admit`, `suspend` and `exit` by `decision-membership`; `nest`, `grant` and `revoke` by `circle-decision`; `seat` and `unseat` by `circle-decision-membership`; `adopt` by `decision-document`), with the arguments its motions take as the New form asks for them: text, a number, or one of the choices a graft adds to the collection's `about` under the key the argument's `options` names. This feat knows no kind; it keeps the register, as it keeps `decision.cites`.
- `decision.motion`: what a decision decides, numbered in the order proposed, a motion of a registered kind and its arguments as JSON. The kind's graft reads it and its guards check it.

Triggers keep a closed decision closed and refuse stances on it, and refuse a motion once a stance is given or the decision closed, so no one consents to one thing and is counted for another, raising SQLSTATE `09000`. The app role may select, insert and update decisions, select and insert votes as the policy on secret stances lets it, and select and insert motions; the guards role, `cella_guards`, may select them all.

Who may vote on a decision, its roll, is the `circle-decision-membership` graft's: the members seated in its circle when it was proposed.

### Ballots

A decision is taken by open or secret ballot, fixed as it is proposed: its procedure's, unless the proposal names the other. The built-in procedures a motion is put by are open, and `circle-decision-membership`'s Propose… and Appoint… name a secret ballot for electing or removing a person, as co-ops commonly do; a co-op's own procedure says which its decisions take. `decision.secret(decision)` says whether one is secret.

- **Open**: a stance is logged as given, and every member reads every stance.
- **Secret**: the vote logs the stance as a salted commitment (`cella.personal` registers `decision.vote.stance`), and the vault keeps the stance under its member's key. The entry names its actor, as every entry does, so the log says that a member gave a stance and when, never which. In the read model, a row-level policy lets the app read a secret stance only as its own member's, or in a write's transaction; the guards role reads them all. How the roll and the tally show is `circle-decision-membership`'s: the tally sealed until the close, each member's stance never.

`decision.cites` lists the writes that cite a decision: each settles only once the decision its payload names has closed and passed. A graft that joins this feat to a write's feat declares the write's op there; the graft that counts the roll attaches its guard to every action listed. The app role and the guards role may select it.

## Guards

- `decision.proposes`, on `decision:decision:propose`: the write proposed the decision on the verdict date, open until a later deadline, with as many motions as its payload names. `decision.balloted`, on the same action: its ballot is the one the payload names. That each motion applies is the guard of the graft registering its kind; that the actor sits in the circle, `circle-decision-membership`'s.
- `decision.closes`, on `decision:decision:close`: the write closed the decision on the verdict date, and not before its deadline. A decision closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.
- `decision.posts`, on `decision:message:post`: the message is the actor's own and names the decision, the message it answers, the mentions and the links its payload does. That each mention names one member is `decision-membership`'s guard, that each link names a document `decision-document`'s.
- `decision.own_stance`, on `decision:decision:vote`: the stance is the actor's own (`cella.actor()`); no member votes for another. `decision.seals`, on the same action: a stance on a secret ballot is logged by its commitment alone, one on an open ballot as given. That the actor is on the decision's roll is `circle-decision-membership`'s guard on the same action. A stance needs no power.

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent`, `cella.majority` or `cella.share` over the roll, by the decision's procedure and its quorum, as the `circle-decision-membership` graft does.

## Handlers

- `vote` (confluent): the member's own stance, with the write's receipt, `cella.receipt()`, which the notary signs; logged as a single-entry batch, the stance marked personal on a secret ballot. A stance for another member, off the roll or on a closed decision returns `Refused`, as the guards and the trigger judge it; the handler throws for none of them.
- `propose` (confluent): inserts the decision by the procedure it names, its rule the procedure's and its ballot the one the proposal names or else the procedure's, numbered the year's next (`d-2026-013`) under a lock on the numbering, proposed on the verdict date, and its motions; circle-decision-membership's `propose` replaces it in the shell and fixes the roll in the same write, by `proposing`, the write this one makes. Submits `{ decision, circle, procedure, ballot, deadline, motions }`: the title and the text are the proposer's words and stay out of the log.
- `post` (confluent): the acting member's message, with the write's receipt, perhaps answering another; the form reads the handles it mentions and the documents it links from its text (`models/thread.ts`). Submits `{ decision, member, message, reply, mentions, links }`, without the text.
- `close` (ordered), and `closing`, the same as a write a graft extends in its transaction: sets the closed date to `cella.verdict_date()` and the cutoff to the close's own receipt, then submits. `circle-decision-membership` replaces it in the shell with a close that counts the roll and admits and seats in the same verdict; where that graft is mounted, this close alone counts no roll and its guard `counts` refuses it.

## Grafts

- `circle-decision-membership`, which this feat declares: a decision's roll, from the seats in its circle, and whether it passes on it.

## Shell

The `decisions` collection, open ones first. Its New form proposes one:
the circle it is put in, from those `circle-decision` lists in the
collection's `about`; the procedure, its terms in words, a secret ballot among them, which follows
the circle's until another is chosen; the deadline, the title and the text; and what
it decides, a kind from `decision.kind`, whose arguments the form then
asks for. A decision's page shows its proposal and each motion it
decides, its arguments by its kind's labels, a member by name, every stance given as its activity, on a secret ballot the reader's own alone, and closes it (`close`).
Its roll, its outcome and the stance form are `circle-decision-membership`'s;
the stance it posts is this feat's `vote`, for the acting member.

A decision's state is open, passed or rejected: open until its close,
then passed or rejected by the outcome of the stances the close froze.
The outcome is the graft's, so the state is too: `circle-decision-membership`
reads it in SQL and gives the collection its State column and its board.
This feat reads only whether and when a decision closed.

A decision's page has three tabs: Overview, the proposal in full under its
deadline, and what the grafts say is decided (whom it admits, the
version it adopts, the outcome); Stances, the roll and the acting
member's stance; and Discussion, its deliberation, each message under
the one it answers, a mention drawn by `decision-membership`'s `member` embed
and a link by `decision-document`'s `document` embed, and while it is
open a message as the acting member, or a reply to the one chosen. The stances given in time order stay in the drawer's
Activity card, their one home.

A decision drawn elsewhere is one card, the feat's `Card` (`./app`):
its title, circle, rule and where it stands, linking to its page, over
the decisions `summaries` (`./api`) reads. `decision-document` embeds
it in documents, `decision-meeting` in a meeting's minutes.

## Domain

Ported from seedling's `specs/feat/06-decisions.md` under this repo's labels and grafts: proposals with what they decide, stances and the close. Amendments, delegation, a second call without a quorum and closing early once everyone has spoken are not built.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `decision.decisions` and `decision.procedures` to the analytics shell: each decision, its procedure and its days. Stances are not shared: a secret ballot's roll is never shown, and an open one's is on the decision's page.
