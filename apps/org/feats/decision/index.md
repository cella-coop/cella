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

## Schema

`decision` (`core/sql/`):

- `decision.decision`: circle, title, rule (`consent` or `majority`), proposed, deadline and body; on close, the date it closed and its cutoff, the receipt the close took.
- `decision.vote`: a stance by receipt, the decision, the member's address and the day they give. Receipts order stances; only those received before the cutoff count.

Triggers keep a closed decision closed and refuse stances on it, raising SQLSTATE `09000`. The app role may select, insert and update decisions, and select and insert votes.

## Rules

- `decision.closes`, on `decision:decision:close`: the write closed the decision on the verdict date, and not before its deadline. A decision closes only at or after its deadline; closing early once every member has spoken needs to know who the members are, which is a graft's, and is not built.

The outcome itself is not this feat's to fix: it is folded from the votes by `cella.consent` or `cella.majority` where it is used, as the `decision-member` graft does.

## Handlers

- `vote` (confluent): the member's own stance, with `cella.receipt()`, logged as a single-entry batch.
- `close` (ordered): sets the closed date to `cella.verdict_date()` and the cutoff to `cella.receipt()`, then submits.

## Domain

To port from seedling's `specs/feat/06-decisions.md`, under this repo's labels and grafts.
