+++
title = "document-motion"
updated = 2026-11-01
+++

Adoption by motion: what content of which document a motion asks to
adopt, and motions drawn inside documents. Declared by the `document`
feat.

## Schema

`document_motion` (`sql/`): `document_motion.adoption`, a motion
and the document it asks to adopt, by their ids, with the content it
adopts named by its canonical hash (the BLAKE3 the database gave the
version) and the version the proposer read it in: a view of the actions
of the `adopt` kind, each joined to the version it names. The action is
the motion feat's row and a version never changes, so the graft reads
both and keeps no copy. The app role and the guards role, `cella_guards`,
may select.

It registers the `adopt` kind with the motion feat (`sql/002-adopt.sql`):
an action naming a version, which the New form picks from the versions
this graft adds to the motions' `about`.

## Guards

- `document_motion.asks`, on `motion:motion:propose`: each action
  to adopt names a version, and no two name versions of one document.
- `document_motion.adopts`, on `document:document:adopt`: the cited
  motion asks to adopt this document, and the version adopted hashes as
  the motion names it. The members consented to content, not to a row:
  a version saved later with other content is refused, one holding the
  same content is not.

- `document_motion.links`, on `motion:message:post`: each link a
  message gives names a document or one of its versions
  (`document_motion.linked`).

An adoption cites its motion: this graft declares
`document:document:adopt` in `motion.cites`, and `circle-membership-motion`,
which counts the roll, attaches its guard that the motion closed and
passed. This graft joins two feats and so cannot read the roll, a
three-way graft's; it never needs to. That the version is the document's
and its base has not moved is the document feat's guard (`base: 'adopted'`).

Adopting rate-card-2027@2 under m-2026-011 so passes three guards, each at
the lowest level that sees what it checks: the document's base, the
motion's content, and the roll's outcome.

## Shell

- On a motion's Overview, the version it asks to adopt, in full: read
  with the document feat's `Reader` from the version's canonical form as
  the database computed it, with its version id, its hash and the version
  it would replace, or the day it was adopted.
- In a motion's discussion, the `document` embed: each link drawn by
  its document's title, linking to its page.
- On a document's page, the motions that adopt its versions, and the
  `motion` embed: a motion drawn inside the document as the motion
  feat's card (its title, circle, method and whether it is open), and offered in the editor's
  slash menu. Every motion of the scope is offered; a picker that
  searches replaces the list when they are many.

- On the New motion form, `Adopt a document version`, with the versions
  to pick from, newest first by document: a meeting's minutes among them,
  which a circle that adopts its minutes (`circle-meeting`) adopts this
  way. The adoption itself, once the
  motion passes, is the document's `adopt` write, which the shell does
  not offer yet.

## Lanterne

m-2026-007 adopted internal-rules@3 on 20 June 2026; m-2026-011 asks to
adopt rate-card-2027@2, by its hash, coordination's motion, open until
9 November while Malik objects. The rate card's version 2 embeds
m-2026-011.
