+++
title = "Policy"
updated = 2026-11-05
+++

The register of policies (`@cella/org-policy`): every binding sentence a
circle adopted by motion, a mandate, a right, a rule or a procedure, with the
motion that adopted it, the days it applies and the default it takes, and
the legal forms cella offers with their default policies
([policies](../../../../_corpus/doc/architecture.md#policies)). A core
library, as the notary is: it knows no feat, and every feat and graft
reads it.

## SQL

`sql/001-policy.sql` makes the schema `policy`:

- `policy.form`: a legal form in a region, as cella offers it, by its
  id (`scop-sarl-fr`), its label (`SCOP SARL`) and its region (`France`)
  ([legal forms](../../../../_corpus/doc/forms.md)).
- `policy.default`: a default policy of a form, `scop-sarl-fr:ordinary`,
  in the form's order: its kind, its legal wording and its friendly one,
  their hash as `policy.hash` makes it, the procedure that alone changes
  it, if any, the law it states, by its article (`source`), or none where
  it is cella's practice, and the day a co-op lawyer reviewed it
  (`reviewed`), empty until one has. Each form's own migration offers its
  defaults, `sql/002-scop-sarl-fr.sql` the SCOP SARL's.
- `policy.policy`: a policy, named by the action that adopted it, its
  motion and its number there (`m-2026-013/1`); its circle, its kind
  (`mandate`, `right`, `rule` or `procedure`), the BLAKE3 of its wordings
  (`policy.hash`), the day it was adopted, the day it applies from, the
  day it ends, if any, after the day it applies where its adoption sets
  it, since it binds until the day before it ends (`policy.in_force`),
  or the day a motion ends or replaces it, which may be that day, the
  policy it replaces, and the action that ended
  it (`ended_by`, `m-2026-020/1`), if a motion did; and, for a protected
  policy, the procedure by which alone it is replaced or ended
  (`protected`), by its name, as the motion feat names it, since the
  register knows no feat. Which motion that lets change it is the motion
  feat's guard ([protected policies](../../feats/motion/index.md#protected-policies));
  and the default policy it takes, if any (`takes`), worded and protected
  as that default read when it was adopted.
- `policy.wording`: its legal wording, which binds, each value marked
  once as `{name: value}`, and its friendly wording, if any, which never
  binds and marks none.
- `policy.value`: each value the legal wording marks, in the order it
  reads: its name, its type (`amount` in cents, `share` in percent,
  `day`, `number`, `role`, `power` or `text`), as written and typed,
  and which way is stricter (`stricter`, `more` or `less`), where its
  mark says so after a bar, `{account_minimum: 20 | more is stricter}`.

Its functions:

- `policy.marks(legal)` and `policy.typed(name, literal)`: the values a
  wording marks, which way each says is stricter, and each one's type and
  value from how it is written.
- `policy.flaw(legal, friendly)`: what is wrong with the wordings, or
  null: a legal wording says something, marks each value once and with a
  value, holds no brace that is not a mark, and says which way is
  stricter as `more is stricter` or `less is stricter`, if at all; a
  friendly one marks none. `policy.flaw(kind, legal, friendly)` adds the
  kind's: a text, a role or a power says no way is stricter, and each
  value of a rule that is an amount, a share, a day or a number says
  which way is.
- `policy.sentence(legal)`: the wording as it reads, each mark replaced
  by its value as written, without its direction.
- `policy.says(id)`: a policy's sentence as it reads, which a guard may
  quote in the reason it refuses; it runs with its owner's rights, and
  the app role and the guards role may call it.
- `policy.hash(legal, friendly)`: what a motion adopts, the BLAKE3 of the
  two as a JSON array, the friendly wording trimmed and an empty one
  none, as `policy.wording` keeps it. It is the one canonical form:
  `policy.adopt`, `policy.offer` and `policy.takes_flaw` hash only
  through it, so a policy hashes as the wordings it keeps, and one that
  takes a default with its friendly wording padded or left empty stands
  `taken`, never `updated`.
- `policy.in_force(circle, day)`: a circle's policies applying on a day.
- `policy.adopt(circle, kind, legal, friendly, motion, n, applies, until,
  replaces, protected, takes)`: a write, inside the write of the action
  that adopts the policy; `protected`, the procedure that alone changes
  it, and `takes`, the default it takes, may be left out. It refuses a
  wording flawed for its kind, a policy adopted already, an end not after
  the day it applies, so the register keeps no policy that is never in
  force, a replacement of
  a policy not in force in that circle and kind, a default it does not
  read and is not protected as (`policy.takes_flaw`), and a default a
  policy in force there takes already, unless this one replaces it
  (SQLSTATE `09000`); keeps the policy, its wordings and its values; and
  ends the policy it replaces the day it applies.
- `policy.end(ref, by_motion, by_n)`: the other write, inside the write of
  the action that ends the policy: it ends on the verdict date, by that
  action. It refuses a policy not in force on the verdict date.
- `policy.offer(form, key, kind, legal, friendly, protected, source)`:
  offers a default of a form, from the form's migration: a new one after
  the form's others, or the same one on a new wording, as a later release
  of cella ships it, which changes no policy and is reviewed anew. It
  refuses a wording flawed for its kind. Only a migration calls it.
- `policy.takes_flaw(takes, kind, legal, friendly, protected)`: what keeps
  a policy from taking a default, or null: the default is offered, and
  the policy is of its kind, hashes as its wordings do and is protected as
  it is. It reads no wording, so a guard may call it, as the motion feat's
  do.
- `policy.standing(circle, day)`: where each default of every form the
  circle took any default of stands on a day, in the form's order: `taken`
  by a policy in force as it reads; `updated`, taken as it read before
  cella changed it; `left`, its last policy ended, by the motion's action
  that replaced it with one taking none or that ended it (`left_by`), on
  `left_on`; or `not taken`.
- `policy.left_by(motion)`: the defaults a motion's actions left, each
  with the policy that took it and the action that left it.

`policy.adopt` and `policy.end` run with their owner's rights, and only
the app role may call them.

The app role and the guards role, `cella_guards`, may select the
policies and their values; only the app reads the wordings. The app reads
the forms and their defaults whole, the guards role every column of a
default but its wordings. A slice's SQL that reads `policy.wording` is
refused by `cella check feats`: a guard reads a policy's values from its
own columns, never its sentence, which it may only quote, by
`policy.says`.

## TypeScript

- `kinds`: the three kinds, as the New motion form offers them.
- `adopting(tx, policy)`: `policy.adopt` in a write's transaction, as
  the motion feat's `adopt` calls it; returns the policy's id.
- `ending(tx, policy, motion, n)`: `policy.end` in a write's
  transaction, as the motion feat's `end` calls it; returns the day it
  ends.
- `sentences(db, ids)`: the legal wording of each policy named, as it
  reads, by its id, as a circle's page shows a mandate.
- `inForce(db, circle)`: a circle's policies in force today, each with
  its sentence as it reads, its wordings, its values, its days and the
  procedure that alone changes it, if any, the default it takes, if
  any, and whether cella has changed that default since (`outdated`).
- `inOrder(db, circle, day)`: a circle's policies in force on a day, in
  their order, each with its kind and its sentence as it reads: each
  where the first policy of its line reads, the policy it replaces, the
  one that replaced, and so on back, by the motion and the action that
  adopted that one, so a replacement takes its place; as the document
  feat generates the statutes.
- `register(db)`: every policy, newest first.
- `defaults(db)`: every default the register offers, form by form in its
  order, each with its form in words, its sentence as it reads, its source
  and the day it was reviewed, as the New motion form offers them.
- `standing(db, circle, day?)`: `policy.standing`, today unless a day is
  named; `departures(db, circle, day?)`, the defaults among them the
  circle left or never took, as its page lists them and the statutes
  read them.
- `leftBy(db, motion)`: `policy.left_by`, as a motion's page lists them.

## Tests

A core has no slice tests of its own: every slice test migrates the
app's core, and the motion feat's `_tests/policy.test.ts` tests the
register beside the feat's guards; `tools/_tests/policy.test.mjs`, that
a guard reading a wording is refused; the e2e scenario `policy`, an
adoption on Lanterne; and `forms`, Lanterne's SCOP SARL defaults taken,
left by motion and updated by cella.
