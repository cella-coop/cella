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

## Domain

To port from seedling's `specs/feat/06-decisions.md`, under this repo's labels and grafts.
