+++
title = "Membership"
updated = 2026-11-01
+++

A person's membership, from invited to exited, with the shares they hold.
Membership records who belongs; it decides nothing. It is nested in
`person`, whose core it inherits: who a member is, their name and their
devices, is the person's, and the membership holds only what belonging
adds.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/membership/invite` | confluent | a fact; two invitations do no harm |
| `POST /api/membership/link` | confluent | a fact; two links do no harm, and the first taken up ends them all |
| `POST /api/membership/accept` | ordered | enrols the invitee's first device, ordered against revoke as any enrolment |
| `POST /api/membership/admit` | ordered | changes who votes |
| `POST /api/membership/suspend` | ordered | changes who votes |
| `POST /api/membership/exit` | ordered | freezes the capital account |
| `POST /api/membership/erase` | ordered | erasure wins over every update |

A person's own name and contact details are the person's writes
(`profile`, `forget`).

## Powers

Nothing is allowed by omission: each write needs a power or declares its
check.

| Action | Power or check | Lanterne |
|---|---|---|
| invite, link | `invite-member` | every member, through the assembly's `member` role |
| accept | self: the invitee, signed by the device it enrols | whoever holds the link |
| admit | decided: the cited decision admits the member and carried | the assembly, by consent |
| suspend, exit | decided: the cited decision suspends the member, or ends their membership, and carried | the assembly |
| erase | decided: the cited decision erases a member who has left, and carried | the assembly |

`004-powers.sql` registers invite's power in `cella.power`, and `008-link.sql` link's; the decided
writes are listed in `decision.cites` by the `decision-membership` graft.

## Schema

`membership` (`core/sql/`):

- `membership.member`, one row per address, with status (`invited`,
  `active`, `suspended`, `exited`), `since` (admitted) and shares, and the
  days it was `invited`, `suspended` and `exited`. A trigger lets a status
  move only along that lifecycle, raising SQLSTATE `09000` otherwise. The
  app role may select, insert and update; the guards role, `cella_guards`,
  may select.
- `membership.link`, an invitation's links, each by its digest: the
  SHA-256 of a 32-byte secret the inviter's browser drew, which only the
  link (`/join/<secret in hex>`) holds, the member it invites and the day
  it was made. The server keeps the digest, never the secret. An invited
  member may hold several; the first taken up ends them all.
- `membership.invitation`, an invitation taken up: the invitee's address,
  the public key of the first device it enrolled, the label they gave it
  and the day (`accepted`). One per member. `membership.signs`, a trigger
  after a member moves from invited to active, refuses an admission of
  someone who holds no current device, SQLSTATE `09000`, so no member is
  admitted unable to sign, and nothing it wrote stays; a worker invited to
  join signs with the device their hire enrolled.
- `membership.active(person, day)`, whether the person held an active
  membership that day: admitted on or before it, and not yet suspended
  nor gone. It is what a graft asks of an active member, rather than
  reading the status; the record keeps one day per move, so a day inside
  a suspension since lifted reads as active.

## Personal data

A membership holds none of its own: the name and contact details it shows
are the person's. Its address is the pseudonym every entry names the
member by, commented not personal (`006-erase.sql`). The invitation's
payload commits to the invitee's name when the invitation brings in a new
person, and to its link's digest; an acceptance's, to the link and the key
it enrolled, so the log says which device took the invitation up. The
label is the invitee's wording and stays out.

## Guards

- `membership.invites`, on `membership:member:invite`: the write invited the member, on the verdict date.
- `membership.carries`, on `membership:member:invite`: the link its payload names, if any, is the member's, made by this write.
- `membership.links`, on `membership:member:link`: the member is invited and has not taken up their invitation, and the link was made by this write.
- `membership.accepts`, on `membership:member:accept`: the actor is whom the link invites, still invited; the invitation was taken up by this write, by the device it enrolled, which signed it (`cella.device()`): enrolled under their address, by no device, on the verdict date.
- `membership.admitted`, on `membership:member:admit`: the write left the member active, since the verdict date, holding shares. The `decision-membership` graft runs it again for each member a decision's close admits.
- `membership.ends`, on `membership:member:suspend` and `:exit`: the write left the member suspended, or exited, on the verdict date.
- `membership.erases`, on `membership:member:erase`: the member has left, and the write erased every class of their personal data, at once or restricted.

Whether the cited decision asks it is the `decision-membership` graft's guard on the same actions; whether it closed and passed on its roll, `circle-decision-membership`'s.

## Handlers

- `invite` (confluent), and `inviting`, the same as a write: brings the
  person in (`entering`, the person's), inserts the membership invited on
  the verdict date, holding nothing, and its link, if it comes with one;
  submits `{ member, invited, link? }`, and the name, committed, only
  when the person is new. A link that is not 32 bytes in hex is refused
  before it reaches the notary.
- `link` (confluent): a new link for someone invited, as a lost one is
  replaced or an imported member first given one; submits `{ member,
  link }`. Someone never invited is refused before the notary.
- `accept` (ordered): the invitee takes up their invitation with the
  link's secret and the public key their browser just made, and that
  device signs the write. Enrols the device (`enrolling`, the person's) under their address on the
  verdict date, by no device, so the keyring finds it in this write's own
  state, and records the acceptance; submits `{ member, link, key,
  accepted }`. A secret no link of theirs is the digest of, an
  invitation taken up already or a device enrolled already is refused
  before the notary.
- `admit` (ordered), and `admitting`, its state alone, which the close of the deciding decision runs in its own transaction: makes an invited member active since `cella.verdict_date()` with their shares; a member not invited is left as they are, for the guards to refuse. Submits `{ member, shares, decision }`.
- `suspend`, `exit` (ordered): set the status and its day; submit `{ member, decision }`. `circle-decision-membership` carries them out when the decision that asks them passes.
- `erase` (ordered): submits `{ member, decision, erasure }`, the erasure of every class of the member's personal data, which the notary carries out as it settles: the person's name and contact details deleted from the vault and redacted, payroll, receipts and the books restricted until their clocks run out. `circle-decision-membership` carries it out when the decision that asks it passes.

### The exit's hook

An exit freezes the member's capital, which is the books', not this
feat's. The exit sets `status` to `exited` and `exited` to the verdict
date in its own transaction, and its payload names the member and the
decision: a graft joining `membership` to the books (`account-membership`)
attaches a trigger to that update, or a guard to `membership:member:exit`, and
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
invitation carries the digest of its link, never the secret; taking it up
with another secret, for someone else, or signed by a key it does not
enrol is refused, and the right one enrols the device by no device, once;
a new link is for someone invited who has not taken it up; an admission
of someone holding no device is refused and leaves nothing, and one of
someone who took it up enrols nothing more.

## Shell

The membership is its parent's people's, so it adds to the `people`
collection rather than owning one. Each row gains the Member chip, the
membership's status, to filter and group by, with the shares and the day
admitted beside it; the New form gains an invitation, under "Invite to
join", whose link the inviter's browser draws: the write carries its
digest, and once it settles the form shows the link, once, to pass on. A
person's page gains the membership's days and shares and, once taken up,
the first device the invitation enrolled and the day; while they are
invited and have not, the Devices step offers a new link, shown the same
way. Taking an invitation up is the shell's `/join/<secret>` page,
through `accept`; proposing their admission,
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
sentences from its own guards and parameters, so the page says what the
guards say. For a person who is no member, both say what joining would be.

In the inbox, the person's parent's, the membership adds their invitation
while they are invited, to take up on their Joining tab.

## Import

Members from another tool's list, a CSV with the columns `address` (or
`email`) and `name`: the importer `members`, each line an invitation
with no link, whom the importer gives a link from their page
([import](../../../import/index.md)). A row without an address or a name is
refused.

## Domain

Ported from seedling's `specs/feat/10-members.md` under this repo's labels
and grafts. A candidate's probation is `employment-membership`'s, since it
is served in employment; leave and member categories are not built.

## Lanterne

Twelve memberships: ten active, Paul's exited on 30 November 2025, and
Inès's invited on 30 September 2026, who took up her invitation on
1 October on her phone, which it enrolled; d-2026-012's close admits her.

## Analytics

Its [analytical contract](../../../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `membership.members` to the analytics shell: each member's standing, shares and days, by address.
