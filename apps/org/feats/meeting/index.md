+++
title = "Meeting"
updated = 2026-11-09
+++

Circles meeting: when and where, what is on the agenda, and whether the
meeting was held. A meeting belongs to a circle, named by its id with no
foreign key, as a project names its circle; who is expected and who came
are the grafts' (`meeting-membership`, `meeting-membership`), the
motions an agenda tables `meeting-motion`'s, and the minutes, a
document, `document-meeting`'s.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| meeting | `id`, `circle`, `title`, `at`, `place`, `link?`, `scheduled?`, `status`, `settled?`, `minuted?` | `id` is the circle and the day; `at` the scope's wall-clock time |
| item | `id`, `meeting`, `pos`, `title`, `presenter`, `minutes?` | an item of the agenda; `minutes` its length |

## Lifecycle

| Thing | States |
|---|---|
| meeting | scheduled → held, or cancelled; its minutes begun on `minuted` |
| item | on the agenda while the meeting is scheduled; fixed once it is held |

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/meeting/schedule` | confluent | a fact; a second meeting of a circle on one day is numbered |
| `POST /api/meeting/item.add`, `.move`, `.remove` | confluent | an item's place is its own register; fixed by the hold |
| `POST /api/meeting/hold` | ordered | held or cancelled, never both; it fixes the agenda and who came |
| `POST /api/meeting/cancel` | ordered | as hold |
| `POST /api/meeting/minute` | confluent | idempotent: the first day stands |

- **schedule** puts a meeting of a circle at a day and time, in a place,
  online or both.
- **item.add** appends an item to the agenda; **item.move** moves one to
  an index of the agenda as its mover read it, its position becoming the
  midpoint of its new neighbours', so a move changes only its own row and
  two moves of different items commute; **item.remove** drops one. A
  graft that ties an item to something of its own, as a motion it
  tables, runs `adding` in its own write.
- **hold** and **cancel** settle a scheduled meeting on the verdict date;
  whichever settles first stands. Holding fixes the agenda, and who came,
  which `meeting-membership`'s trigger refuses after it. No meeting is held
  before its day.
- **minute** records the day the minutes were begun; `document-meeting`
  replaces it with the write that also starts the minutes' document.

## Powers

| Action | Power or check | Lanterne |
|---|---|---|
| schedule, cancel | `schedule-meeting` | a circle's lead, the manager for any circle |
| item.add, .move, .remove | `discuss`, held in the meeting's circle | the circle's participants |
| hold, minute | `keep-minutes` | a circle's secretary or its lead |

`002-powers.sql` registers the powers; the membership feat checks the actor
holds them and `meeting-membership` that they reach the meeting's
circle; the agenda's writes need the participant's `discuss`, which
`meeting_membership.sits` holds to a seat in the meeting's circle.

## Invariants

The meeting feat owns:

- a meeting held or cancelled stays so; only its minutes' day may still
  be set, and a cancelled meeting has none;
- the agenda changes only while its meeting is scheduled;
- a meeting is held on or after its day;
- a meeting is of a circle core holds, and a setting of one too, each by
  a foreign key into core's circle table.

What it does not own: who is
expected and whether the meeting is quorate (`meeting-membership`),
who came (`meeting-membership`), what motion an item tables
(`meeting-motion`) and the minutes' text (`document-meeting`).

## Schema

`meeting` (`core/sql/`): `meeting.meeting` and `meeting.item`, as in the
entities above. `meeting.stays_settled` keeps a settled meeting settled;
`meeting.open_agenda` reads the meeting `FOR SHARE` on every change to
its items and refuses one once it is held, so an edit and a concurrent
hold are serialised, as a time entry and its month's approval are. The
triggers raise SQLSTATE `09000`. The app role may select, insert and
update, and delete items; the guards role, `cella_guards`, may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`meeting.meeting.circle` is the circle that meets; its agenda items are
in its circle, which `meeting.in_its_circle` copies into each as it is
made. `meeting.setting` is keyed by its circle.

An item's presenter names a person, so it is personal data of class
`profile`, erased when asked, its subject the item, since no column
names whose it is, by its id as text, `ref`, which a trigger keeps (`core/sql/005-personal.sql`): a write commits to it
in the log, and the vault keeps it. A meeting's title, place and link,
and an item's title, are the circle's work and enter the log as they
are.

## Folds

Each action folds by `core/sql/006-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
a meeting scheduled under the id its entry names, of its circle, at its
time, with its title, place and link, on the entry's day; an item added
under its id at the position its entry gives as its text, since a
payload holds no float, with its title, or where its member signed it
blank for an extending graft to fill, the one it took (`named`), its
minutes, and its presenter as its commitment, the feat's trigger putting it in its meeting's circle;
an item moved to the position its entry gives, and one removed; a
meeting held or cancelled on its entry's day; and its minutes begun on
the entry's day, keeping their first. The feat's triggers judge each
again as it folds.

## Circles

A meeting names its circle, its owning circle, by a foreign key into
core's circles, so a meeting of no circle is impossible, and the feat
keeps how each circle meets (`003-circle.sql`, and
in the shell `meeting/circles`, `api/circles.ts` and `app/circles.ts`).
Who is expected, the circle's seats, is `meeting-membership`'s, since
whether a seat counts is the membership feat's.
Each write with a power on a meeting, its schedule, hold, cancel and
minutes, names the meeting's circle in its payload, which the membership
feat's guard reads a mandate's scope against
([membership](../membership/index.md#seats)).

- `meeting.setting`, by circle: its `quorum`, the share of its seats a
  meeting needs present, in percent, and `adopts`, whether its minutes
  bind only once adopted by motion. A circle with no row needs half its
  seats and keeps its minutes as written. Its circle is a foreign key into
  core's circles. The app role and the guards role may select; settings are
  seeded, as nothing writes them yet.
- In the shell, on a meeting's page its circle, linked, and its quorum
  and how its minutes bind; on a circle's, its next meeting, its quorum,
  how its minutes bind and its latest meetings.

Lanterne: the assembly needs half its members and adopts its minutes by
motion, at its next session; coordination needs half its seats and
keeps its minutes as written.

## Guards

- `meeting.holds`, on `meeting:meeting:hold`: the write held the meeting
  on the verdict date, which is not before its day.
- `meeting.cancels`, on `meeting:meeting:cancel`: the write cancelled it
  on the verdict date.

## Handlers

- `schedule` (confluent): the id is `<circle>-<day>`, numbered after a
  dash for a second meeting that day.
- `add`, `move`, `remove` (confluent), and `adding`, add's write.
- `hold`, `cancel` (ordered): set the status and the day; the trigger
  refuses the second.
- `minute` (confluent), and `minuting`, its write: the first day stands.

## Shell

The `meetings` collection, in Governance, opens as a calendar of the
month by the day each meeting meets (the UI core's calendar layout,
`look.on = 'at'`), each entry tinted by its status; the list, table,
gallery, board by status and dashboard are a click away in the View
card. A new meeting is scheduled from the New form. A meeting's page,
its header's crumb its id, has two tabs: **Overview**, its content, the
minutes `document-meeting` draws there, a document read as a document
is, and under them its Activity: scheduled, minutes begun, held or
cancelled; and **Agenda**, the data central to it, the agenda as the UI
core's `Ordered` list, its items dragged into order (each drop the
`move` write, shown at once by `AgendaState` and put back if refused),
removed and added while the meeting is scheduled, with what the grafts
add under it, the motions it tables and who came. Its circle, day,
place and link are its properties. Holding and cancelling are the
header's writes.

## Tests

- Slice tests (`core/ts/_tests/`): a held meeting's agenda fixed, a
  scheduled one's moving, a settled meeting staying so, a cancelled one
  without minutes, and the hold and cancel guards, no hold before the day;
  a setting's circle and bounds, and a meeting of no circle refused
  (`setting.test.ts`).
- `_e2e/meetings.test.ts`: Lanterne's meetings seeded; Camille schedules
  coordination, its members add and reorder its agenda and table the
  rate card, mark themselves, Malik records others and may not record
  Thomas, who holds no seat there; Malik holds it and begins the minutes,
  which open on the meeting's card, and writes them in the editor.

## Lanterne

- The general assembly of 20 June 2026, held at the studio: the 2025
  accounts and the surplus (m-2026-006) and the internal rules, version 3
  (m-2026-007); all ten members present; its minutes a block document
  citing both motions.
- Coordination every Monday at 10:00 from 7 September to 19 October,
  held, at the studio and online, over the pipeline, staffing, the rate
  card (m-2026-011) and Inès's admission (m-2026-012); Léa came as a
  guest on 21 September; the 26 October one scheduled.
- The general assembly of 31 October 2026, scheduled, its agenda Inès's
  admission, the 2027 rate card and the minutes of 20 June.
- The working circles' own: Operations on 5 October, Julien alone,
  over September's close and the print buyer's mandate (m-2026-010);
  Brand's review on 15 October and Web on 20 October, held and marked by
  their leads, Web's tabling its accessibility motion (m-2026-017);
  Marketing's of 22 October cancelled, its next on 29 October, and Web's
  next on 3 November, scheduled.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `meeting.meetings` and `meeting.items` to the analytics shell: each meeting, its circle and its days, and the items on its agenda with their time. Both are scoped by `circle`, the circle that owns the meeting or the item.
