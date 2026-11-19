+++
title = "circle-policy"
updated = 2026-11-19
+++

Core's graft joining the circles to the policy register, two of org's
core feats that know nothing of each other
([core grafts](../../../../../_corpus/doc/architecture.md#core-grafts)).
A mandate, a right, open books' disclosure values, the publication and
the coop's particulars are each a policy's: a sentence a circle adopted by motion, its values
marked in it. The circles keep them in their own tables by the policy's
id ([circle](../../circle/index.md#mandates)), and the register keeps
the policy ([policy](../../policy/index.md)); this graft reads the one
and writes the other, through the circles' writes.

## Schema

`circle_policy` (`sql/`) holds no table, only what reads both:

- `001-circle-policy.sql`: a policy's values as the register types them
  (`circle_policy.mandated`, `circle_policy.disclosure_of`,
  `circle_policy.publication_of`, `circle_policy.particulars_of`,
  `circle_policy.marks_of`), what is wrong
  with them for their kind (`circle_policy.mandate_flaw`,
  `circle_policy.right_flaw`, `circle_policy.disclosure_flaw`), the
  mandate a mandate policy is issued under (`circle_policy.parent_of`, by
  the circles' `circle.parent_for`), the copies of a policy as it is
  adopted and ends, and the guards over them.
- `002-register.sql`: the register's tables under the circles'
  row-level policies, which the register, knowing no circle, cannot put
  them under: a member of the scope, a write's transaction and anyone
  signed in while the coop publishes its register read every policy,
  its wordings and its values ([who reads the
  structure](../../circle/index.md#who-reads-the-structure)), and the
  forms and their defaults are registries every reader reads. And
  `circle_policy.says(id)`, a policy's legal wording as it reads, to
  whoever reads the register, by the register's own `policy.says`, which
  no role calls but through it.
- `003-folds.sql`: how a policy's adoption and end apply to the circles.

It writes no table: a mandate is issued by `circle.issue`, a right
given by `circle.give`, open books' values set by `circle.disclose`, a
publication made by `circle.publish`, the particulars set by
`circle.particularise`, and what a policy granted revoked
by `circle.withdraw`, each the circles' own write
([writes stay home](../../../../../_corpus/doc/architecture.md#writes-stay-home)).

## Copies

`circle_policy.mandate_from(policy)`, in the write that adopts a
policy: first what the policy it replaces granted is revoked the day it
applies, whatever it is, its mandate with every mandate issued under it
(`circle.withdraw`); then a disclosure rule's values are copied into
open books (`circle_policy.disclosure_from`) and a publication's parts
into the publication (`circle_policy.publication_from`) and the
particulars' into `circle.particulars` (`circle_policy.particulars_from`),
each refused
where its values are unsound or its days meet another's it does not
replace (`circle.overlap_flaw`); and a mandate policy's values are
issued as its mandate, by the circle that adopted it, under the mandate
it holds for the power, or a right policy's given as its right. Values
that grant nothing are refused, saying what is wrong (SQLSTATE
`09000`). It returns the mandate, or none for a right or a policy of
another kind, and every mandate it revoked.

`circle_policy.mandate_ended(policy)`, in the write that ends a
policy: what it granted is revoked the day it ends (`circle.withdraw`),
and returns the same.

## Handlers

- `granting(tx, policy)` and `revoking(tx, policy)`, the state of a
  write the motion feat extends: `circle_policy.mandate_from` and
  `circle_policy.mandate_ended`, each returning the mandate, or none,
  and every mandate it revoked, the one ended or replaced first, which
  the motion feat submits.

## Guards

The motion feat attaches each to its own actions:

- `circle_policy.grants`, on `motion:policy:adopt`: a mandate policy
  the write adopted has its mandate, to the grantee, for the power,
  capped, scoped and on the days its values and its policy say, issued
  by the circle that adopted it under the mandate it holds; a right
  policy its right; no policy of another kind has one; a disclosure rule
  has its values in `circle.disclosure`, a publication its parts in
  `circle.publication` and the particulars their values in
  `circle.particulars`; and what the policy it replaces granted is
  revoked the day it applies, with every mandate issued under it
  (`circle.outlives`, the first still standing, as a reason).
- `circle_policy.revokes`, on `motion:policy:end`: the mandate, the
  right, the disclosure values, the publication or the particulars of a
  policy the write
  ended are revoked by the day it ends, and with the mandate every
  mandate issued under it.
- `circle_policy.sovereign`, on both: a write that ends, or adopts a
  policy replacing, one that grants the assembly a collective
  `adopt-policy` mandate with no `until` (`circle.sovereign_by`) leaves
  it still keeping one (`circle.sovereignty`).

The motion feat judges a grant's values before its policy exists, as
its form asks, by the same SQL: `circle_policy.mandate_flaw`,
`circle_policy.right_flaw`, `circle_policy.disclosure_flaw` and the
circles' `circle.publication_flaw` and `circle.particulars_flaw`
([motion](../../../feats/motion/index.md)).

## Folds

`motion:policy:adopt` and `motion:policy:end`
(`circle_policy.fold_granting`, `circle_policy.fold_revoking`), after
the motion feat's own folds, run `circle_policy.mandate_from` or
`circle_policy.mandate_ended` on the register as it then stands, the
mandate's id pinned to the entry's (`circle.pin_mandate`), and refuse a
mandate or a revocation other than the entry's. A right's, a
disclosure's, a publication's and the particulars' ids are not in the entry, so they come
from their sequences.

## Shell

A mandate's page reads as its policy's sentence (`sentences` in
`@cella/org-policy`), its subtitle, and names the motion that adopted
it, Adopted by, linking to the motion's page: the graft extends the
circles' `mandates` collection with both, since the circles' own page
knows no policy.
