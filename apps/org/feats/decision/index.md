+++
title = "Decision"
updated = 2026-10-24
+++

Proposals, votes and outcomes. An outcome is computed from the signed votes, never claimed; each member's latest vote counts once.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/decision/propose` | confluent | a proposal is a fact |
| `POST /api/decision/vote` | confluent | signed by the member; their latest vote counts |
| `POST /api/decision/close` | ordered | the notary fixes which votes made the deadline |

None needs a power; each declares the check that allows it. **propose** and **close** need a seat in the decision's circle (`check: 'seat'`), **vote** a place on its roll (`check: 'roll'`) and the stance being the actor's own. Seats and rolls are `circle-decision-member`'s, which registers the rules: `circle_decision_member.sits` on propose and close, `on_roll` on vote. Lanterne's assembly decisions are put and closed by any of its ten members; coordination's by its five.

## Schema

`decision` (`core/sql/`):

- `decision.decision`: circle, title, rule (`consent` or `majority`), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took.
- `decision.vote`: a stance by receipt, the decision, the member's address and the day they give. Receipts order stances; only those received before the cutoff count.

Triggers keep a closed decision closed and refuse stances on it, raising SQLSTATE `09000`. The app role may select, insert and update decisions, and select and insert votes; the rules role, `cella_rules`, may select both.

Who may vote on a decision, its roll, is the `circle-decision-member` graft's: the members seated in its circle when it was proposed.

`decision.cites` lists the writes that cite a decision: each settles only once the decision its payload names has closed and passed. A graft that joins this feat to a write's feat declares the write's op there; the graft that counts the roll attaches its rule to every op listed. The app role and the rules role may select it.

## Rules

- `decision.closes`, on `decision:decision:close`: the write closed the decision on the verdict date, and not before its deadline. A decision closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.
- `decision.own_stance`, on `decision:decision:vote`: the stance is the actor's own (`cella.actor()`); no member votes for another. That the actor is on the decision's roll is `circle-decision-member`'s rule on the same op. A stance needs no power.

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent` or `cella.majority` over the roll, as the `circle-decision-member` graft does.

## Handlers

- `vote` (confluent): the member's own stance, with the write's receipt, `cella.receipt()`, which the notary signs; logged as a single-entry batch. A stance for another member, off the roll or on a closed decision returns `Refused`, as the rules and the trigger rule it; the handler throws for none of them.
- `close` (ordered): sets the closed date to `cella.verdict_date()` and the cutoff to the close's own receipt, then submits.

## Grafts

- `circle-decision-member`, which this feat declares: a decision's roll, from the seats in its circle, and whether it passes on it.

## Domain

To port from seedling's `specs/feat/06-decisions.md`, under this repo's labels and grafts.
