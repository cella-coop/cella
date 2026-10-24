+++
title = "decision-document"
updated = 2026-10-24
+++

Adoption by decision: which version of which document a decision asks to
adopt. Declared by the `document` feat.

## Schema

`decision_document` (`sql/`): `decision_document.adoption`, a decision and
the version of a document it asks to adopt, by their ids, with no foreign
key into either feat. The app role may select and insert; the rules role,
`cella_rules`, may select.

## Rules

- `decision_document.adopts`, on `document:document:adopt`: the cited
  decision asks to adopt this version of this document.

An adoption cites its decision: this graft declares
`document:document:adopt` in `decision.cites`, and `circle-decision-member`,
which counts the roll, attaches its rule that the decision closed and
passed. This graft joins two feats and so cannot read the roll, a
three-way graft's; it never needs to. That the version is the document's
and its base has not moved is the document feat's rule (`base: 'adopted'`).

Adopting rate-card-2027@2 under d-2026-011 so passes three rules, each at
the lowest level that sees what it checks: the document's base, the
decision's request, and the roll's outcome.

## Shell

Adds the version a decision adopts to the decision's page, and the
decisions that adopt a document's versions to the document's. Adopting
from the shell is not offered yet.

## Lanterne

d-2026-007 adopted internal-rules@3 on 20 June 2026; d-2026-011 asks to
adopt rate-card-2027@2, coordination's decision, open until 9 November
while Malik objects.
