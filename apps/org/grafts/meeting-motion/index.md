+++
title = "meeting-motion"
updated = 2026-11-07
+++

Motions on an agenda: an item that tables a motion, and where the
motion stands. Declared by the `meeting` feat.

## Schema

`meeting_motion` (`sql/`): `meeting_motion.tabled`, an item by its
id and its meeting's, and the motion it tables, by theirs, with no
foreign key into either feat. An item tables one motion at most; a
motion may be tabled at several meetings, as one is discussed in
coordination before its assembly votes. A trigger refuses an item not on
its meeting's agenda and a motion that does not exist. An item removed
leaves its row, which the reads no longer find. The app role may select
and insert; the guards role, `cella_guards`, may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

Tabling is the meeting feat's `meeting:item:add`, run with the link in
one transaction under one verdict, as `project-timesheet` books time:
the item is titled as the motion unless named, and the seat guard on
the action judges who adds it. It is a write of its own name, `table`, on a
meeting's page, beside the feat's `item`.

## Folds

The graft has no action of its own: it folds the meeting feat's
`meeting:item:add`, on which its write tables a motion, by
`meeting_motion.fold_add` (`sql/002-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)),
once the feat's fold has added the item. An entry that names a motion
tables it under the item and meeting the entry names; one that names
none writes nothing here. An item titled as the motion it tables keeps
the blank title its member signed, and its entry carries the motion's
title it took as `named`, which the feat's fold reads, so an agenda
line names the motion in the log as it does on the page.

## Shell

Under a meeting's agenda, the motions it tables, each by its item and
where it stands, open until its deadline or closed, and tabling an open
one while the meeting is scheduled; the `motion` embed, so the
meeting's page reads its minutes' motions as their document does; on
a motion's page, the meetings it is tabled at.

The embed's card is the motion feat's `Card`, the one
`document-motion` draws too, over the motions the feat's
`summaries` reads.

## Lanterne

Coordination tabled the rate card, m-2026-011, on 12 and 19 October,
and Inès's admission, m-2026-012, on 19 October, once it was proposed;
the assembly of 31 October tables both. The assembly of 20 June tabled m-2026-006 and
m-2026-007.

Slice tests: the trigger's two sides.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `meeting_motion.tablings` to the analytics shell: which motion each meeting's agenda item tables. It is scoped by `circle`, the circle that owns each row.
