+++
title = "Document"
updated = 2026-10-24
+++

Drafts, versions and adoption. Edits and comments merge through Loro; an adoption names the version it saw.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/document/edit` | confluent | Loro merges them |
| `POST /api/document/comment` | confluent | anchored to the text, needs no notary |
| `POST /api/document/adopt` | ordered | names the version it saw; refused if that moved on |

## Grafts

- `decision-document`
