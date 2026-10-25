+++
title = "Membership"
updated = 2026-10-25
+++

A person's membership, from invited to exited, with the shares they hold.
Membership records who belongs; it decides nothing. It is nested in
`person`, whose core it inherits: who a member is, their name and their
devices, is the person's, and the membership holds only what belonging
adds.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/membership/invite` | confluent | a fact; two invitations do no harm |
| `POST /api/membership/admit` | ordered | changes who votes |
| `POST /api/membership/suspend` | ordered | changes who votes |
| `POST /api/membership/exit` | ordered | freezes the capital account |
| `POST /api/membership/erase` | ordered | erasure wins over every update |

A person's own name and contact details are the person's writes
(`profile`, `forget`).

## Powers

Nothing is allowed by omission: each write needs a power or declares its
check.

| Write | Power or check | Lanterne |
|---|---|---|
| invite | `invite-member` | every member, through the assembly's `member` role |
| admit | decided: the cited decision admits the member and carried | the assembly, by consent |
| suspend, exit | decided: the cited decision suspends the member, or ends their membership, and carried | the assembly |
| erase | decided: the cited decision erases a member who has left, and carried | the assembly |

`004-powers.sql` registers invite's power in `cella.power`; the decided
writes are listed in `decision.cites` by the `decision-membership` graft.

## Schema

`membership` (`core/sql/`):

- `membership.member`, one row per address, with status (`invited`,
  `active`, `suspended`, `exited`), `since` (admitted) and shares, and the
  days it was `invited`, `suspended` and `exited`. A trigger lets a status
  move only along that lifecycle, raising SQLSTATE `09000` otherwise. The
  app role may select, insert and update; the rules role, `cella_rules`,
  may select.
- `membership.invitation`, the first device an invitation carries: the
  invitee's address, the public key their device made and the label they
  gave it. A key is carried by one invitation. `membership.enrol`, a
  trigger after a member moves from invited to active, enrols it among the
  person's devices in that write's own transaction, on the verdict date,
  enrolled by no device. An admission whose invitation carries no device is
  refused, SQLSTATE `09000`, so no member is admitted unable to sign, and
  nothing it wrote stays.

## Personal data

A membership holds none of its own: the name and contact details it shows
are the person's. Its address is the pseudonym every entry names the
member by, commented not personal (`006-erase.sql`). The invitation's
payload commits to the invitee's name when the invitation brings in a new
person, and always to the key, so the log says which device an admission
enrolled; the label is the invitee's wording and stays out.

## Rules

- `membership.invites`, on `membership:member:invite`: the write invited the member, on the verdict date.
- `membership.carries`, on `membership:member:invite`: the invitation carries the key its payload names, which no device holds yet.
- `membership.admitted`, on `membership:member:admit`: the write left the member active, since the verdict date, holding shares. The `decision-membership` graft runs it again for each member a decision's close admits.
- `membership.ends`, on `membership:member:suspend` and `:exit`: the write left the member suspended, or exited, on the verdict date.
- `membership.erases`, on `membership:member:erase`: the member has left, and the write erased every class of their personal data, at once or restricted.

Whether the cited decision asks it is the `decision-membership` graft's rule on the same ops; whether it closed and passed on its roll, `circle-decision-membership`'s.

## Handlers

- `invite` (confluent), and `inviting`, the same as a write: brings the
  person in (`entering`, the person's), inserts the membership invited on
  the verdict date, holding nothing, and the first device it carries;
  submits `{ member, invited, key }`, and the name, committed, only when
  the person is new. A key that is not 32 bytes in hex, or one another
  invitation carries, is refused before it reaches the notary.
- `admit` (ordered), and `admitting`, its state alone, which the close of the deciding decision runs in its own transaction: makes an invited member active since `cella.verdict_date()` with their shares; a member not invited is left as they are, for the rules to refuse. Submits `{ member, shares, decision }`.
- `suspend`, `exit` (ordered): set the status and its day; submit `{ member, decision }`. `circle-decision-membership` carries them out when the decision that asks them passes.
- `erase` (ordered): submits `{ member, decision, erasure }`, the erasure of every class of the member's personal data, which the notary carries out as it settles: the person's name and contact details deleted from the vault and redacted, payroll, receipts and the books restricted until their clocks run out. `circle-decision-membership` carries it out when the decision that asks it passes.

### The exit's hook

An exit freezes the member's capital, which is the books', not this
feat's. The exit sets `status` to `exited` and `exited` to the verdict
date in its own transaction, and its payload names the member and the
decision: a graft joining `membership` to the books (`account-membership`)
attaches a trigger to that update, or a rule to `membership:member:exit`, and
so settles or is refused with the exit itself. A reaction to the settled
op in a slice's `on` runs only for a write made from a page, not for one
a close carries out, so the freeze belongs in SQL.

## Grafts

- `decision-membership`
- `document-membership`
- `decision-employment-membership`, declared by `employment`
- `employment-membership`, at `person`, declared by `employment`

## Tests

`core/ts/_tests/invitation.test.ts` (`cella test slice membership`): an
invitation carries the key its payload names; an admission with no first
device is refused and leaves nothing; the admission enrols the carried
device, by no device, on its day.

## Shell

The membership is its parent's people's, so it adds to the `people`
collection rather than owning one. Each row gains the Member chip, the
membership's status, to filter and group by, with the shares and the day
admitted beside it; the New form gains an invitation carrying the
invitee's first device, under "Invite to join". A person's page gains the
membership's days and shares and, until the admission enrols it, the
first device the invitation carried; proposing their admission,
suspension or exit is `circle-decision-membership`'s. Seats and powers are
`circle-membership`'s.

The page gains two tabs. Joining lists what joining asks, step by step,
each kept by the slice that knows it: the membership's own, invited and
then admitted, and a device that signs; the admission once a probation
ends (`decision-employment-membership`); the texts to read
(`document-membership`); the circles (`circle-membership`); and the
capital (`account-membership`). Own and decide reads back in plain
sentences what membership is, one member, one vote; what the member owns,
from the statutes' terms (`account-membership`); and what they decide,
from their seats and mandates (`circle-membership`). Each slice writes its
sentences from its own rules and parameters, so the page says what the
rules say. For a person who is no member, both say what joining would be.

In the inbox, the person's parent's, the membership adds their invitation
while they are invited, to take up on their Joining tab.

## Import

Members from another tool's list, a CSV with the columns `address`,
`name`, `key` and `label`: the importer `members`, each line an
invitation carrying the device the key names. A row without a key is
refused: an invitation carries the first device of whom it invites
([import](../../../import/index.md)).

## Domain

Ported from seedling's `specs/feat/10-members.md` under this repo's labels
and grafts. A candidate's probation is `employment-membership`'s, since it
is served in employment; leave and member categories are not built.

## Lanterne

Twelve memberships: ten active, Paul's exited on 30 November 2025, and
Inès's invited on 30 September 2026, whose invitation carries her phone;
d-2026-012's close enrols it.
