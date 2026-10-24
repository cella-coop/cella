+++
title = "decision-meeting"
updated = 2026-10-24
+++

Decisions on an agenda: an item that tables a decision, and where the
decision stands. Declared by the `meeting` feat.

## Schema

`decision_meeting` (`sql/`): `decision_meeting.tabled`, an item by its
id and its meeting's, and the decision it tables, by theirs, with no
foreign key into either feat. An item tables one decision at most; a
decision may be tabled at several meetings, as one is discussed in
coordination before its assembly votes. A trigger refuses an item not on
its meeting's agenda and a decision that does not exist. An item removed
leaves its row, which the reads no longer find. The app role may select
and insert; the rules role, `cella_rules`, may select.

## Writes

Tabling is the meeting feat's `meeting:item:add`, run with the link in
one transaction under one verdict, as `project-timesheet` books time:
the item is titled as the decision unless named, and the seat rule on
the op judges who adds it. It is a write of its own name, `table`, on a
meeting's page, beside the feat's `item`.

## Shell

Under a meeting's agenda, the decisions it tables, each by its item and
where it stands, open until its deadline or closed, and tabling an open
one while the meeting is scheduled; the `decision` embed, so the
meeting's page reads its minutes' decisions as their document does; on
a decision's page, the meetings it is tabled at.

The embed's card is drawn here and in `decision-document` alike: two
grafts of one order cannot share a block, and the card belongs in the
decision feat's client side.

## Lanterne

Coordination tabled the rate card, d-2026-011, on 12 and 19 October,
and Inès's admission, d-2026-012, on 12 October; the assembly of 31
October tables both. The assembly of 20 June tabled d-2026-006 and
d-2026-007.

Slice tests: the trigger's two sides.
