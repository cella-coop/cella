+++
title = "Policy"
updated = 2026-11-02
+++

The register of policies (`@cella/org-policy`): every binding sentence a
circle adopted by motion, a mandate, a rule or a procedure, with the
motion that adopted it and the days it applies
([policies](../../../../_corpus/doc/architecture.md#policies)). A core
library, as the notary is: it knows no feat, and every feat and graft
reads it.

## SQL

`sql/001-policy.sql` makes the schema `policy`:

- `policy.policy`: a policy, named by the action that adopted it, its
  motion and its number there (`m-2026-013/1`); its circle, its kind
  (`mandate`, `rule` or `procedure`), the BLAKE3 of its wordings
  (`policy.hash`), the day it was adopted, the day it applies from, the
  day it ends, if any, the policy it replaces, and the action that ended
  it (`ended_by`, `m-2026-020/1`), if a motion did.
- `policy.wording`: its legal wording, which binds, each value marked
  once as `{name: value}`, and its friendly wording, if any, which never
  binds and marks none.
- `policy.value`: each value the legal wording marks, in the order it
  reads: its name, its type (`amount` in cents, `share` in percent,
  `day`, `number`, `role`, `power` or `text`), as written and typed.

Its functions:

- `policy.marks(legal)` and `policy.typed(name, literal)`: the values a
  wording marks, and each one's type and value from how it is written.
- `policy.flaw(legal, friendly)`: what is wrong with the wordings, or
  null: a legal wording says something, marks each value once and with a
  value, and holds no brace that is not a mark; a friendly one marks
  none.
- `policy.sentence(legal)`: the wording as it reads, each mark replaced
  by its value as written.
- `policy.hash(legal, friendly)`: what a motion adopts, the BLAKE3 of the
  two as a JSON array.
- `policy.in_force(circle, day)`: a circle's policies applying on a day.
- `policy.adopt(circle, kind, legal, friendly, motion, n, applies, until,
  replaces)`: a write, inside the write of the action that adopts the
  policy. It refuses a flawed wording, a policy adopted already and a
  replacement of a policy not in force in that circle and kind
  (SQLSTATE `09000`), keeps the policy, its wordings and its values, and
  ends the policy it replaces the day it applies.
- `policy.end(ref, by_motion, by_n)`: the other write, inside the write of
  the action that ends the policy: it ends on the verdict date, by that
  action. It refuses a policy not in force on the verdict date.

Both run with their owner's rights, and only the app role may call
them.

The app role and the guards role, `cella_guards`, may select the
policies and their values; only the app reads the wordings. A slice's SQL
that reads `policy.wording` is refused by `cella check feats`: a guard
reads a policy's values from its own columns, never its sentence.

## TypeScript

- `kinds`: the three kinds, as the New motion form offers them.
- `adopting(tx, policy)`: `policy.adopt` in a write's transaction, as
  the motion feat's `adopt` calls it; returns the policy's id.
- `ending(tx, policy, motion, n)`: `policy.end` in a write's
  transaction, as the motion feat's `end` calls it; returns the day it
  ends.
- `sentences(db, ids)`: the legal wording of each policy named, as it
  reads, by its id, as the circle feat's page shows a mandate.
- `inForce(db, circle)`: a circle's policies in force today, each with
  its sentence as it reads, its wordings, its values and its days.
- `register(db)`: every policy, newest first.

## Tests

A core has no slice tests of its own: every slice test migrates the
app's core, and the motion feat's `_tests/policy.test.ts` tests the
register beside the feat's guards; `tools/_tests/policy.test.mjs`, that
a guard reading a wording is refused; the e2e scenario `policy`, an
adoption on Lanterne.
