+++
title = "Membership"
updated = 2026-11-04
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
| `membership:member:apply` | confluent | an employee asks to join by their own right; a fact, once to a person, made by membership-motion's `apply` with the motion that puts it to the assembly |
| `POST /api/membership/admit` | ordered | changes who votes |
| `POST /api/membership/suspend` | ordered | changes who votes |
| `POST /api/membership/withdraw` | ordered | a member leaves by their own right; their capital's freeze and withdrawal follow it |
| `POST /api/membership/exclude` | ordered | the assembly's motion ends a membership; the capital's freeze and withdrawal follow it |
| `POST /api/membership/erase` | ordered | a person who has left erases their own personal data by their right; erasure wins over every update |

A person's own name and contact details are the person's writes
(`profile`, `forget`).

## Powers

Nothing is allowed by omission: each write needs a power or declares its
check.

| Action | Power or check | Lanterne |
|---|---|---|
| invite, link | `invite-member` | every member, through the assembly's `member` role |
| accept | `accept-invitation`, every person's right: the invitee, signed by the device it enrols | whoever holds the link |
| apply | `apply-membership`, every employee's right: the application is the actor's own, and they have worked a year | each employee of a year, of their own application |
| admit | `admit-member`, a collective mandate: the cited motion admits the member and carried | the assembly, by consent |
| withdraw | `withdraw-membership`, every person's right: the membership is the actor's own, active or suspended until the write | each member, of their own membership |
| suspend, exclude | `suspend-member`, `exclude-member`, collective mandates: the cited motion suspends or excludes the member, and carried | the assembly, by motion |
| erase | `erase-own-data`, every person's right: the membership is the actor's own, and they have left | each former member, of their own data |

`004-powers.sql` registers invite's, apply's, withdraw's and erase's powers in `cella.power`, and `008-link.sql` link's and accept's; the writes a motion carries
are listed in `motion.cites`, with their powers, by the `membership-motion` graft.

## Schema

`membership` (`core/sql/`):

- `membership.member`, one row per address, with status (`invited`,
  `active`, `suspended`, `exited`), `since` (admitted) and shares, and the
  days it was `invited`, `applied`, `suspended` and `exited`. A trigger lets a status
  move only along that lifecycle, raising SQLSTATE `09000` otherwise. The
  app role may select, insert and update; the guards role, `cella_guards`,
  may select.
- `membership.link`, an invitation's links, each by its digest: the
  SHA-256 of a 32-byte secret the inviter's browser drew, which only the
  link (`/join/<secret in hex>`) holds, the member it invites and the day
  it was made. The server keeps the digest, never the secret. An invited
  member may hold several; the first taken up ends them all. Whom a
  link invites is read by its secret before anyone signs in,
  `membership.invited(secret)`, which reads as its owner past the
  row-level policies and answers only for the secret it is given.
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
  a suspension since lifted reads as active. It is who holds every
  member's right: `009-active.sql` registers it with person's core as
  `member`, by `person.register_right`
  ([rights](../../../circle/index.md#rights)).

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../../../_corpus/doc/architecture.md#sql)): the root's,
the assembly's, unless the write that makes it names another.

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
- `membership.applies`, on `membership:member:apply`: the applicant is the actor, and the write left them invited, having applied on the verdict date; one who is a member, or was, does not apply. That they have worked a year is the `employment-membership` graft's guard on the same action, and that the write put the motion to admit them, `membership-motion`'s.
- `membership.links`, on `membership:member:link`: the member is invited and has not taken up their invitation, and the link was made by this write.
- `membership.accepts`, on `membership:member:accept`: the actor is whom the link invites, still invited; the invitation was taken up by this write, by the device it enrolled, which signed it (`cella.device()`): enrolled under their address, by no device, on the verdict date.
- `membership.admitted`, on `membership:member:admit`: the write left the member active, since the verdict date, holding shares. The `membership-motion` graft runs it again for each member a motion's close admits.
- `membership.withdraws`, on `membership:member:withdraw`: the member is the actor, and the write left them exited on the verdict date; the lifecycle lets only an active or a suspended member exit.
- `membership.ends`, on `membership:member:suspend` and `:exclude`: the write left the member suspended, or exited, on the verdict date.
- `membership.erases`, on `membership:member:erase`: the member is the actor and has left, and the write erased every class of their personal data, at once or restricted.

Whether the cited motion of an admission, a suspension or an exclusion asks it is the `membership-motion` graft's guard on the same actions; whether it closed and passed on its roll, `membership-motion`'s.

## Handlers

- `invite` (confluent), and `inviting`, the same as a write: brings the
  person in (`entering`, the person's), inserts the membership invited on
  the verdict date, holding nothing, and its link, if it comes with one;
  submits `{ member, invited, link? }`, and the name, committed, only
  when the person is new. A link that is not 32 bytes in hex is refused
  before it reaches the notary.
- `applying`, the application as a write, which only
  `membership-motion`'s `apply` runs, in the transaction that puts
  the motion to admit the applicant: invites the applicant on the
  verdict date, holding nothing, or marks the invitation they hold
  already, and records the day they applied; submits `{ member, applied
  }`. One applies once: someone who is a member, or was, or has applied
  already, is refused before the notary. The
  feat has no `apply` of its own, since an application that puts no
  motion is refused.
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
- `admit` (ordered), and `admitting`, its state alone, which the close of the deciding motion runs in its own transaction: makes an invited member active since `cella.verdict_date()` with their shares; a member not invited is left as they are, for the guards to refuse. Submits `{ member, shares, motion }`.
- `withdraw` (ordered): the member leaves by their own right, signing it themselves: sets the status `exited` and its day; submits `{ member }`, citing no motion. Someone withdrawing another is refused by the guards, and a member who left withdrawing again before the notary.
- `suspend`, `exclude` (ordered): set the status and its day; submit `{ member, motion }`. `membership-motion` carries them out when the motion that asks them passes.
- `crediting`, inside another write's transaction: adds shares to what an active member holds, and refuses a member who is not. It is no action of its own: the write that runs it and its guards decide how many, as `account-membership-patronage-transaction`'s `employ` adds the shares an associate's part of the work share buys.
- `erase` (ordered): a person who has left erases their own personal data by their right, signing it themselves: submits `{ member, erasure }`, citing no motion, the erasure of every class of their personal data, which the notary carries out as it settles: their name and contact details deleted from the vault and redacted, payroll, receipts and the books restricted until their clocks run out. Someone erasing another, or a member who has not left, is refused by the guards.

### The exit's hook

An exit, a withdrawal or an exclusion, and an admission change the
member's capital, which is the books', not this feat's. Each sets the
status and its day in its own transaction, and its request names the
member and the motion, the shares too for an admission, and no motion
for a withdrawal: a graft joining `membership` to the books reacts to
the settled op in its slice's `on` with a write of its own, citing the
same motion, or for a withdrawal signed by the member as their own, as
`account-membership` freezes the member's capital accounts and
`account-membership-transaction` subscribes and withdraws their capital. The shell runs the reactions to the writes a
close carries out as to one made from a page, and the close reports each
admission it made, so they follow it too. No trigger on `member` does
it.

## Seats

Whether a seat counts on a day, and so who may use a power: core's
circles hold the seats and the mandates
([circle](../../../../core/circle/index.md#seats)), and whether a seat
counts is this feat's to say, since the assembly's asks an active
membership. Its SQL is `010-may.sql` to `015-rights.sql`; its part of
the shell, `membership/seats`, is `api/seats.ts` and `app/seats.ts`.

- `membership.counts(person, circle, day)` (`014-counts.sql`): whether a
  seat counts on a day: in the assembly, where the person is active
  (`membership.active`); in any other circle, where the person is one
  the co-op knows (`person.known`) and this feat has not suspended them
  or let them go. A worker who is no member, invited or never, holds a
  seat in their working circle; a suspended member's seats grant nothing
  until the suspension is lifted.
- `membership.sits_in(person, circle, day)`: they hold a seat in the
  circle on the day, and it counts; the guards that know the circle an
  action concerns ask it.
- `membership.may(actor, power, cents, about, day)`: the actor holds,
  on the day, a seat that counts, whose role, or the participant role
  every seat holds, has a mandate in force for the power, not revoked
  by the day, whose scope covers `about`, the owning circle of the
  record a write concerns (`circle.covers`, [core's
  scope](../../../../core/circle/index.md#mandates)), within its `limit`
  when the write carries an amount. A mandate marking no scope covers
  every circle's records; one on a circle (`{scope: web}`) that
  circle's alone; one on `own` those of the circle of the seat it is
  held by, so a lead's covers their own circle and no other. Circles
  never nest, so a power held in one circle reaches no other by where
  it sits; the record's circle grants nothing by itself, and a seat in
  it nothing without a mandate. `about` null asks of no record and any
  mandate for the power answers it, as a key's reach and the log's
  disclosure ask. A `budget` is not checked: it needs the spend over its
  period tracked.
- `membership.covered(actor, power, day)` (`013-authority.sql`): the
  owning circles whose records the actor's mandates for the power cover
  on the day, by the same seats and mandates as `may`: every circle for
  one marking no scope, the seat's circle for `own`, the circle it
  names for any other. With `may` it is the authority every read asks
  (`cella.authority`): on the verdict date it says in which circles
  the reader holds `read`, or a power a feat names as reading its rows
  in `cella.reading`
  ([reading](../../../../core/circle/index.md#reading)), and it finds no
  right.
- `membership.entitled(actor, power, cents, day)` (`015-rights.sql`):
  the actor holds the power by a right, with no seat: a right in force
  in `circle.right`, on every person, member or employee, within its
  `limit`, where person's core says the actor is one of them on the day
  (`person.holds`). A right lets each act on what is their own, which
  the feat's guard checks, so it opens no one else's rows to read
  ([rights](../../../../core/circle/index.md#rights)). A right reaches
  the whole co-op.
- `membership.empowered`, on every action in `cella.power`, the one
  guard that reads a permission's scope: the actor may use the action's
  power on the verdict date over the record the write concerns, by a
  seat's mandate covering its circle (`may`) or by a right
  (`entitled`), for the amount the payload names in the action's
  `amount` field. The payload names the record's owning circle,
  `circle`, as its handler reads it from the record or writes it there,
  and one naming none concerns the root's, the assembly's. Refused, it
  says whether the actor holds the power by no mandate covering that
  circle or by none at all. Each feat and core registers the power its
  actions need in `cella.power`; this feat attaches its guard to every
  op listed, then and later, as `membership-motion` attaches its own to
  `motion.cites`. A write with no power, or whose power is in
  `motion.cites`, a collective mandate's, gets no such guard. No slice
  checks a scope again: a project's, a month's and a meeting's circle
  are read here, from the payload their writes name.
- `membership.sits`, on `circle:circle:message` (`011-sits.sql`): the
  actor holds a seat that counts in the circle on the verdict date,
  where the participant's `discuss` is held.

Lanterne: Camille holds the gérante role by a tenure from 20 June 2024
until 20 June 2028, and acts alone under its mandates while it runs.
Julien issues invoices, records payments, posts entries, closes
periods and pays suppliers up to 3 000 € a payment, as finance; Chloé
holds only the `member` role in the assembly, so she edits clients and
documents and does none of these; Camille's `commit` mandate, up to
20 000 €, is not needed by any write yet. A suspended member holds no
seat's mandate. Inès, invited and employed, no member yet, sits in Web
since her hire: she holds Web's participant mandates there, proposing
and discussing in Web, and none of the assembly's; beside them, a
person's rights and an employee's. Paul, gone, holds a person's alone.

In the shell, `membership/seats` adds a circle's seats to its page, one
row per person with every role they hold in it, and how many sit in it
to the list and its gallery cards; and to a person's page their seats
and the powers they hold through them, each power by its plain name
and its policy's sentence, the mandates `membership.may` would grant
before any limit is spent, and to the list the circles they sit in;
under Joining, whether they sit in the assembly and in a working
circle; and under Own and decide, what they decide read back as
sentences: where they sit, how each of those circles decides, and the
mandates they act by, each as its policy reads, its limit in it.

## Grafts

- `membership-motion`
- `document-membership`
- `employment-membership-motion`, declared by `employment`
- `employment-membership`, at `person`, declared by `employment`

## Tests

`core/ts/_tests/invitation.test.ts` (`cella test slice membership`): an
invitation carries the digest of its link, never the secret; taking it up
with another secret, for someone else, or signed by a key it does not
enrol is refused, and the right one enrols the device by no device, once;
a new link is for someone invited who has not taken it up; an admission
of someone holding no device is refused and leaves nothing, and one of
someone who took it up enrols nothing more.
Its inviter acts by a mandate of a seat that counts, and the invitee
takes it up by a person's right, as `membership.empowered` asks.
`counts.test.ts`, `may.test.ts` and `rights.test.ts`: a seat counts in
the assembly for an active member and elsewhere for anyone known whom
membership has not suspended or let go; a mandate's scope covers the
records of its circle, its holder's own or the whole co-op, and a seat
with no mandate covers none; and a right is held by
whoever person's core says is one of its people, with no seat.

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
suspension or exclusion is `membership-motion`'s. A member's own
page offers them Withdraw, which asks them to confirm and signs
`withdraw`; no one else's page offers it. Once they have left, their own
page offers them Erase my data instead, which says what the law keeps,
asks them to confirm and signs `erase`. Seats and powers are this
feat's `membership/seats` ([seats](#seats)).

The page gains two tabs. Joining lists what joining asks, step by step,
each kept by the slice that knows it: the membership's own, invited and
then admitted, and a device that signs; the admission once a probation
ends (`employment-membership-motion`); the texts to read
(`document-membership`); the circles ([seats](#seats)); and the
capital (`account-membership`). Own and decide reads back in plain
sentences what membership is, one member, one vote; what the member owns,
from the statutes' terms (`account-membership`); and what they decide,
from their seats and mandates ([seats](#seats)). Each slice writes its
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
1 October on her phone, which it enrolled; m-2026-012's close admits her.

## Analytics

Its [analytical contract](../../../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `membership.members` to the analytics shell: each member's standing, shares and days, by address.
