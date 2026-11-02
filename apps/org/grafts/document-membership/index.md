+++
title = "document-membership"
updated = 2026-11-02
+++

Who has read the co-op's texts: a member marks a document's binding
version read, which is what joining asks of a new member. Declared by
the `membership` feat.

## Schema

`document_membership` (`sql/`):

- `document_membership.reading`: a version, a member and the day they read
  it, once each, with no foreign key into either feat.
- `document_membership.texts`: for each member, every document's binding
  version, its latest adoption, and the day they read it, or none; a
  later adoption asks a new reading.

The app role may select, insert and keep a reading's first day; the
guards role may select.

## Actions

| Action | Label | Check | Why |
|---|---|---|---|
| `document-membership:version:read` | confluent | `self` | a fact the member states of themselves; marking a version read again changes nothing |

## Guards

- `document_membership.reads`, on `document-membership:version:read`: the
  reading is the actor's own, of a version that exists, marked on the
  verdict date.

## Tests

`ts/_tests/reading.test.ts` (`cella test slice document-membership`): the
texts each member is to read, a new adoption asking a new reading, and
the guard outside a write.

## Shell

On a person's page, under Joining, the texts the co-op adopted, whether
they read each, and marking one read, their own.

## Lanterne

The ten members read the internal rules' third version before the
assembly adopted it on 20 June 2026; Inès has not marked it read yet. The
statutes, generated from the assembly's policies, are the other text to
read, `statutes@2` since 20 June 2026; no member has marked them read.
