+++
title = "decision-document"
updated = 2026-10-24
+++

Adoption by decision: what content of which document a decision asks to
adopt, and decisions drawn inside documents. Declared by the `document`
feat.

## Schema

`decision_document` (`sql/`): `decision_document.adoption`, a decision
and the document it asks to adopt, by their ids, with the content it
adopts named by its canonical hash (the BLAKE3 the database gave the
version) and the version the proposer read it in; no foreign key into
either feat. The app role may select and insert; the rules role,
`cella_rules`, may select.

## Rules

- `decision_document.adopts`, on `document:document:adopt`: the cited
  decision asks to adopt this document, and the version adopted hashes as
  the decision names it. The members consented to content, not to a row:
  a version saved later with other content is refused, one holding the
  same content is not.

An adoption cites its decision: this graft declares
`document:document:adopt` in `decision.cites`, and `circle-decision-member`,
which counts the roll, attaches its rule that the decision closed and
passed. This graft joins two feats and so cannot read the roll, a
three-way graft's; it never needs to. That the version is the document's
and its base has not moved is the document feat's rule (`base: 'adopted'`).

Adopting rate-card-2027@2 under d-2026-011 so passes three rules, each at
the lowest level that sees what it checks: the document's base, the
decision's content, and the roll's outcome.

## Shell

- On a decision's Overview, the version it asks to adopt, in full: read
  with the document feat's `Reader` from the version's canonical form as
  the database computed it, with its version id, its hash and the version
  it would replace, or the day it was adopted.
- On a document's page, the decisions that adopt its versions, and the
  `decision` embed: a decision drawn inside the document as a card (its
  title, circle, rule and whether it is open), and offered in the editor's
  slash menu. Every decision of the scope is offered; a picker that
  searches replaces the list when they are many.

Adopting from the shell is not offered yet.

## Lanterne

d-2026-007 adopted internal-rules@3 on 20 June 2026; d-2026-011 asks to
adopt rate-card-2027@2, by its hash, coordination's decision, open until
9 November while Malik objects. The rate card's version 2 embeds
d-2026-011.
