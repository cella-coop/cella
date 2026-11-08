+++
title = "document-motion"
updated = 2026-11-08
+++

Adoption by motion: what content of which document a motion asks to
adopt, the statutes frozen anew as a motion adopts or ends a policy, and
motions drawn inside documents. Declared by the `document` feat.

## Schema

`document_motion` (`sql/`): `document_motion.adoption`, a motion
and the document it asks to adopt, by their ids, with the content it
adopts named by its canonical hash (the BLAKE3 the database gave the
version) and the version the proposer read it in: a view of the actions
of the `adopt` kind, each joined to the version it names. The action is
the motion feat's row and a version never changes, so the graft reads
both and keeps no copy. The app role and the guards role, `cella_guards`,
may select. It reads as its reader, so a reader who reads no motion of a circle reads none of the versions it adopted, nor their hashes.

It registers the `adopt` kind with the motion feat (`sql/002-adopt.sql`):
an action naming a version, which the New form picks from the versions
this graft adds to the motions' `about`.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

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

An adoption cites its motion: this graft registers
`document:document:adopt` by `motion.register_cite`, with its power, `adopt-document`, a collective mandate of the motion's circle, and `membership-motion`,
which counts the roll, attaches its guard that the motion closed and
passed. This graft joins two feats and so cannot read the roll, a
three-way graft's; it never needs to. That the version is the document's
and its base has not moved is the document feat's guard (`base: 'adopted'`).

Adopting rate-card-2027@2 under m-2026-011 so passes four guards, each at
the lowest level that sees what it checks: the document's base, the
motion's content, the roll's outcome, and coordination's collective
`adopt-document`.

It registers `document:document:generate` by `motion.register_cite` too, with `adopt-policy`, since the statutes are generated as their policies are adopted
(`sql/005-generate.sql`), so `membership-motion`'s guard holds the
statutes' generation to a motion that closed and passed; that the motion
adopted or ended a policy of the document's circle that day, and that
the version reads its policies, are the document feat's guard.

## Folds

A proposal folds by `sql/007-folds.sql`
([folds](../../../../_corpus/doc/architecture.md#folds)), at version 1. What a motion asks to adopt is
its action, which the motion feat's fold writes and `adoption` reads, so
this fold writes nothing: it checks each action to adopt names a version
and no two name versions of one document, as `document_motion.asks`
judged it when it was proposed, and refuses otherwise, saying what it
found.

## Reaction

On `motion:policy:adopt` and `motion:policy:end`, in the write's
transaction: each document generated from the policies of the circle the
policy is of, as the statutes are from the assembly's, is generated
anew by the document feat's `generate`, an effect citing the adoption
or the ending, its actor whoever signed it, and citing the motion, from
the policies in force on the day the adopted policy applies or the ended
one ends, or on the day the adopted version reads where that is later
(`handlers/generate.ts`). A policy of a circle no document is
generated from makes no write. The request names the motion's action,
`n`, so the reaction reads the policy it adopted or ended.

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
  slash menu as one item, whose block asks which motion it shows. Every
  motion of the scope is a choice; a picker that searches replaces the
  list when they are many.

- On the New motion form, `Adopt a document version`, with the versions
  to pick from, newest first by document: a meeting's minutes among them,
  which a circle that adopts its minutes (the meeting feat) adopts this
  way. The adoption itself, once the
  motion passes, is the document's `adopt` write, which the shell does
  not offer yet.

## Lanterne

m-2021-001 adopted the policies `statutes@1` reads on 1 March 2021, and
m-2026-007 the rules `statutes@2` adds on 20 June 2026.
m-2026-007 adopted internal-rules@3 on 20 June 2026; m-2026-011 asks to
adopt rate-card-2027@2, by its hash, coordination's motion, open until
9 November while Malik objects. The rate card's version 2 embeds
m-2026-011.
