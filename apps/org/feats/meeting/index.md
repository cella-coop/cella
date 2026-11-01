+++
title = "Meeting"
updated = 2026-11-01
+++

Circles meeting: when and where, what is on the agenda, and whether the
meeting was held. A meeting belongs to a circle, named by its id with no
foreign key, as a project names its circle; who is expected and who came
are the grafts' (`circle-meeting-membership`, `meeting-membership`), the
decisions an agenda tables `decision-meeting`'s, and the minutes, a
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
  graft that ties an item to something of its own, as a decision it
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
| schedule, cancel | `schedule-meeting` | a circle's lead, the gérante for any circle |
| item.add, .move, .remove | seat: an active member seated in the meeting's circle | the circle's members |
| hold, minute | `keep-minutes` | a circle's secretary or its lead |

`002-powers.sql` registers the powers; `circle-membership` checks the actor
holds them and `circle-meeting-membership` that they reach the meeting's
circle, and backs the seat check (`circle_meeting_membership.sits`).

## Invariants

The meeting feat owns:

- a meeting held or cancelled stays so; only its minutes' day may still
  be set, and a cancelled meeting has none;
- the agenda changes only while its meeting is scheduled;
- a meeting is held on or after its day.

What it does not own: that the circle exists (`circle-meeting`), who is
expected and whether the meeting is quorate (`circle-meeting-membership`),
who came (`meeting-membership`), what decision an item tables
(`decision-meeting`) and the minutes' text (`document-meeting`).

## Schema

`meeting` (`core/sql/`): `meeting.meeting` and `meeting.item`, as in the
entities above. `meeting.stays_settled` keeps a settled meeting settled;
`meeting.open_agenda` reads the meeting `FOR SHARE` on every change to
its items and refuses one once it is held, so an edit and a concurrent
hold are serialised, as a time entry and its month's approval are. The
triggers raise SQLSTATE `09000`. The app role may select, insert and
update, and delete items; the guards role, `cella_guards`, may select.

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
card. A new meeting is scheduled from the New form. A meeting's page
has two tabs: **Agenda**, the agenda as the UI core's `Ordered` list,
its items dragged into order (each drop the `move` write, shown at once
by `AgendaState` and put back if refused), removed and added while the
meeting is scheduled, with what the grafts add under it, the decisions
it tables and who came; and **Minutes**, `document-meeting`'s, a
document read as a document is. Minutes earn their tab: they are a
different thing from the agenda, a text written after it, as a
decision's stances are beside its overview. Holding and cancelling are
the header's writes.

## Tests

- Slice tests (`core/ts/_tests/`): a held meeting's agenda fixed, a
  scheduled one's moving, a settled meeting staying so, a cancelled one
  without minutes, and the hold and cancel guards, no hold before the day.
- `_e2e/meetings.test.ts`: Lanterne's meetings seeded; Camille schedules
  coordination, its members add and reorder its agenda and table the
  rate card, mark themselves, Malik records others and may not record
  Thomas, who holds no seat there; Malik holds it and begins the minutes,
  which open on the meeting's card, and writes them in the editor.

## Lanterne

- The general assembly of 20 June 2026, held at the studio: the 2025
  accounts and the surplus (d-2026-006) and the internal rules, version 3
  (d-2026-007); all ten members present; its minutes a block document
  citing both decisions.
- Coordination every Monday at 10:00 from 7 September to 19 October,
  held, at the studio and online, over the pipeline, staffing, the rate
  card (d-2026-011) and Inès's admission (d-2026-012); Léa came as a
  guest on 21 September; the 26 October one scheduled.
- The general assembly of 31 October 2026, scheduled, its agenda Inès's
  admission, the 2027 rate card and the minutes of 20 June.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `meeting.meetings` and `meeting.items` to the analytics shell: each meeting, its circle and its days, and the items on its agenda with their time.
