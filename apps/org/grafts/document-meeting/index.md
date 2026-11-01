+++
title = "document-meeting"
updated = 2026-11-01
+++

A meeting's minutes, written as a document in the block editor.
Declared by the `meeting` feat.

## Schema

`document_meeting` (`sql/`): `document_meeting.minutes`, a meeting and
the document its minutes are, by their ids, with no foreign key into
either feat; one document a meeting, one meeting a document. A trigger
refuses either side not existing. The app role may select and insert;
the guards role, `cella_guards`, may select.

## Actions

Beginning the minutes is the meeting feat's `meeting:meeting:minute`,
which this graft replaces on a meeting's page with a write that also,
the first time, starts their document, the document feat's `creating`,
in one transaction under one verdict: `minutes-<meeting>`, its draft
opening on the meeting's card, a heading for who was present and one
for each item of the agenda, as the actor's edit. After that, the
minutes are the document already kept. From then on they are written as
any document is, live, by the `edit` write, and saved as versions.

## Guards

- `document_meeting.keeps`, on `meeting:meeting:minute`: a write naming
  a document names the meeting's own minutes.

Minutes bind as written unless their circle adopts them by decision
(`circle-meeting`'s setting); then they are adopted as any document is,
by `decision-document`'s adoption of a version by its hash, cited by a
decision of the circle. This graft adds nothing to adoption.

## Shell

- A meeting's page has a Minutes tab: the minutes' draft read with the
  document feat's `Reader`, with the embeds the meeting's slices draw,
  this graft's meeting card and `decision-meeting`'s decision; how many
  versions they have and which is adopted; and a link to write them in
  the editor. Until they are begun, beginning them.
- The `meeting` embed: a meeting drawn inside a document as a card, its
  title, circle, day and status, linking to it; offered by every draft's
  slash menu. A document's page names the meeting it minutes.

## Lanterne

The minutes of the assembly of 20 June 2026, `minutes-ag-2026-06-20`,
version 1 saved on 22 June: the meeting's card, who was present, and the
2025 accounts and the internal rules each with the decision that decided
them, d-2026-006 and d-2026-007. The assembly adopts its minutes, and
none adopts them yet: the 31 October assembly has them on its agenda.

Slice tests: the junction's sides, and the guard.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `document_meeting.minuted` to the analytics shell: which document holds each meeting's minutes.
