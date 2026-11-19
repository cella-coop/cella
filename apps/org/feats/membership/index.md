+++
title = "Membership"
updated = 2026-11-19
+++

A person's membership, from invited to exited, with the shares they hold.
Membership records who belongs; it decides nothing. It is a feat of
the app whose rows name a core person, as a feat's rows name a circle:
who a member is, their name and their devices, is core's person's
([person](../../core/person/index.md)), and the membership holds only
what belonging adds.

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
  days it was `invited`, `applied`, `suspended` and `exited`, and for an
  exited member how they left, `exit`: `withdrew` by their own right or
  `excluded` by a motion, set by the write that made them exited and
  none before. A trigger lets a status
  move only along that lifecycle, raising SQLSTATE `09000` otherwise. The
  app role may select, insert and update; the guards role, `cella_guards`,
  may select.
  Its statuses are its lifecycle in the models too (`models/status.ts`),
  each with its chip's word, which `cella check feats` holds equal to
  the CHECK and the UI kit draws as the `status` kind
  ([statuses](../../core/ui/index.md#statuses)): invited unstarted,
  active and suspended started, exited completed, keeping the house's
  tones, a member positive, suspended warning, a former member neutral.
- `membership.link`, an invitation's links, each by its digest: the
  SHA-256 of a 32-byte secret the inviter's browser drew, which only the
  link (`/join/<secret in hex>`) holds, the member it invites and the day
  it was made. The server keeps the digest, never the secret. An invited
  member may hold several; the first taken up ends them all. Whom a
  link invites is read by its secret before anyone signs in,
  `membership.invited(secret)`, which reads as its owner past the
  row-level policies and answers only for the secret it is given,
  matching the link by its digest: it is declared `audience: keyed by
  secret` ([reading](../../../../_corpus/doc/architecture.md#reading)).
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
  member's right: `009-active.sql` registers it with core's person as
  `member`, by `person.register_right`
  ([rights](../../core/circle/index.md#rights)).

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's,
the assembly's, unless the write that makes it names another.

## Personal data

A membership holds none of its own: the name and contact details it shows
are the person's. Its address is the pseudonym every entry names the
member by, commented not personal (`006-erase.sql`). The invitation's
payload commits to the invitee's name when the invitation brings in a new
person, and to its link's digest; an acceptance's, to the link and the key
it enrolled, so the log says which device took the invitation up. The
label is the invitee's wording, personal data of class `profile`: the
acceptance commits to it, as the invitation's and as the device's.

## Guards

- `membership.invites`, on `membership:member:invite`: the write invited the member, on the verdict date.
- `membership.carries`, on `membership:member:invite`: the link its payload names, if any, is the member's, made by this write.
- `membership.applies`, on `membership:member:apply`: the applicant is the actor, and the write left them invited, having applied on the verdict date; one who is a member, or was, does not apply. That they have worked a year is the `employment-membership` graft's guard on the same action, and that the write put the motion to admit them, `membership-motion`'s.
- `membership.links`, on `membership:member:link`: the member is invited and has not taken up their invitation, and the link was made by this write.
- `membership.accepts`, on `membership:member:accept`: the actor is whom the link invites, still invited; the invitation was taken up by this write, by the device it enrolled, which signed it (`cella.device()`): enrolled under their address, by no device, on the verdict date.
- `membership.admitted`, on `membership:member:admit`: the write left the member active, since the verdict date, holding shares. The `membership-motion` graft runs it again for each member a motion's close admits.
- `membership.withdraws`, on `membership:member:withdraw`: the member is the actor, and the write left them exited on the verdict date, `exit` `withdrew`; the lifecycle lets only an active or a suspended member exit.
- `membership.ends`, on `membership:member:suspend` and `:exclude`: the write left the member suspended, or exited with `exit` `excluded`, on the verdict date. A carried one refused is forgone in the log with its reason, so the reason names no one: the member's status and the day it began.
- `membership.erases`, on `membership:member:erase`: the member is the actor and has left, and the write erased every class of their personal data, at once or restricted.

Whether the cited motion of an admission, a suspension or an exclusion asks it is the `membership-motion` graft's guard on the same actions; whether it closed and passed on its roll, the motion feat's (`motion.carried`).

## Folds

Each action of the feat says how its entry applies to the state before
it (`sql/017-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)), at version 1, by the
SQL its handler runs with the day and the values its entry carries, so
the triggers its writes fire fire again: an invitation inserts the
invited member and the link it carries; an application, the applicant
invited and applied that day, or applied where invited already; a link,
its digest; an acceptance, the invitation by its key and its label's
commitment; an admission, the member active with the shares it names; a
suspension, an exclusion or a withdrawal, the member's status and day,
unless they stand so already; and an erasure nothing of its own, its
erasure folding as the notary carried it out. What `crediting`
writes for an extender that credits shares folds by
`membership.fold_credit`, which its fold calls: what the member holds
once it credits them, the register's figure its entry keeps, while they
are active, since the shares it credits are theirs and logged as their
commitment.

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
- `withdraw` (ordered): the member leaves by their own right, signing it themselves: sets the status `exited`, its day and `exit` `withdrew`; submits `{ member }`, citing no motion. Someone withdrawing another is refused by the guards, and a member who left withdrawing again before the notary.
- `suspend`, `exclude` (ordered): set the status and its day, and an exclusion `exit` `excluded`; submit `{ member, motion }`. `membership-motion` carries them out when the motion that asks them passes.
- `crediting`, inside another write's transaction: adds shares to what an active member holds, and refuses a member who is not. It is no action of its own: the write that runs it and its guards decide how many, as `account-membership-patronage-transaction`'s `employ` adds the shares an associate's part of the work share buys.
- `erase` (ordered): a person who has left erases their own personal data by their right, signing it themselves: submits `{ member, erasure }`, citing no motion, the erasure of every class of their personal data, which the notary carries out as it settles: their name and contact details deleted from the vault and redacted, payroll, receipts and the books restricted until their clocks run out. Someone erasing another, or a member who has not left, is refused by the guards.

### The exit's hook

An exit, a withdrawal or an exclusion, and an admission change the
member's capital, which is the books', not this feat's. Each sets the
status and its day in its own transaction, and its request names the
member and the motion, the shares too for an admission, and no motion
for a withdrawal: a graft joining `membership` to the books reacts to
the settled op in its slice's `on` with an effect in its transaction,
citing the same motion, or for a withdrawal the member's own, as
`account-membership` freezes the member's capital accounts and
`account-membership-transaction` subscribes and withdraws their capital. `write` runs the reactions to the writes a
close carries out, its admissions among them, in the close's transaction,
as to one made from a page, and an admission stands only with its
subscription. No trigger on `member` does
it.

## Seats

Who may act is core's: the seats and the mandates are core's circles'
([circle](../../core/circle/index.md#seats)), and whether a seat
counts, who holds a power and the guard on every power are core's
graft `circle-person`'s ([who may
act](../../core/grafts/circle-person/index.md#who-may-act)), which
asks each kind of person what bars a seat. This feat says it of the
members, and holds the shares, the capital, the joining and the
leaving; it holds no authority, and a scope without it bars no seat.
Its slice serves the shell `may`, whether a person holds a power over a
circle's records on the verdict date, by a mandate or a right, as
circle-person's guard asks it, which core body's live session asks as
its editors edit ([the live
session](../../core/body/index.md#the-live-session)).
Its SQL is `010-standing.sql`; its part of the shell, `membership/seats`,
is `api/seats.ts` and `app/seats.ts`.

- `membership.standing(person, circle, day)` (`010-standing.sql`),
  registered by `circle_person.register_standing`: why a seat does not
  count on a day, or null where membership bars none. In the assembly
  it bars the seat of anyone not active on the day
  (`membership.active`), saying their membership's status; in any other
  circle that of someone this feat has suspended or let go, so a worker
  who is no member, invited or never, holds a seat in their working
  circle, and a suspended member's seats grant nothing until the
  suspension is lifted. Core's `circle_person.counts` asks it beside
  whether the person is one the coop knows.
- `member`, the right every active member holds (`009-active.sql`),
  registered by `person.register_right`: whom core's `person.holds`
  names for a right given to every member.

Lanterne: Camille holds the manager role by a tenure from 20 June 2024
until 20 June 2028, and acts alone under its mandates while it runs.
Julien issues invoices, records payments, posts entries, closes
periods and pays suppliers up to 3 000 € a payment, as finance; Chloé
holds only the `member` role in the assembly, so she edits contacts and
documents and does none of these; Camille's `commit` mandate, up to
20 000 €, is not needed by any write yet. A suspended member holds no
seat's mandate. Inès, invited and employed, no member yet, sits in Web
since her hire: she holds Web's participant mandates there, proposing
and discussing in Web, and none of the assembly's; beside them, a
person's rights and an employee's. Paul, gone, holds a person's alone.

In the shell, `membership/seats` adds a circle's seats to its page, on
its Roles tab under its roles, one row per person with every role they hold in it, and how many sit in it
to the list and its gallery cards; and to a person's page their seats
and the powers they hold through them, each power by its plain name
and its policy's sentence, the mandates `circle_person.holds` gives on
the verdict date, which `circle_person.may` would grant before any limit
is spent: the participant's `propose` and `discuss` in each circle they
sit in, Inès's in Web, beside their roles', and none of a suspended
member's; and to the list the circles they sit in;
under Membership, whether they sit in the assembly and in a working
circle; and under Membership, what they decide read back as
sentences: where they sit, how each of those circles decides, and the
mandates they act by, each as its policy reads, its limit in it; and
under Authority, their seats and every power they hold and by what
([shell](#shell)).

## Grafts

- `membership-motion`
- `document-membership`
- `employment-membership-motion`, declared by `employment`
- `employment-membership`, declared by `employment`

## Tests

`core/ts/_tests/invitation.test.ts` (`cella test slice membership`): an
invitation carries the digest of its link, never the secret; taking it up
with another secret, for someone else, or signed by a key it does not
enrol is refused, and the right one enrols the device by no device, once;
a new link is for someone invited who has not taken it up; an admission
of someone holding no device is refused and leaves nothing, and one of
someone who took it up enrols nothing more.
Its inviter acts by a mandate of a seat that counts, and the invitee
takes it up by a person's right, as `circle_person.empowered` asks.
`counts.test.ts`, `may.test.ts` and `rights.test.ts`, on core's authority with this feat's standing registered: a seat counts in
the assembly for an active member and elsewhere for anyone known whom
membership has not suspended or let go; a mandate's scope covers the
records of its circle, its holder's own or the whole coop, and a seat
with no mandate covers none; and a right is held by
whoever core's person says is one of its people, with no seat, and
`circle_person.rights` lists a right exactly where `entitled` grants its
power. `powers` (`cella test e2e powers`) reads the Authority tab of
every Lanterne person against `may` and `entitled`, power by power,
each signed in as the person whose page it is, Inès as herself, and a
non-member reading another's tab finds no right on it.
The slice's files run at once on one database. `invitation.test.ts`
commits what it writes, as each of its writes is a transaction of its
own, the notary's; `counts`, `holds`, `may` and `why-not` write inside a
transaction each rolls back; and `rights.test.ts`, whose read as the
app's reader is another connection's, commits its rows and reads only
the rights it registers, never the invitation's.

## Shell

The people are core's person's, so the membership adds to the `people`
collection rather than owning one. Each row gains the Member chip, the
membership's status, to filter and group by, with the shares and the day
admitted beside it; the New form gains an invitation, under "Invite to
join", whose link the inviter's browser draws: the write carries its
digest, and once it settles the form shows the link, once, to pass on. A
person's page gains, as a panel of its overview, where they stand as a
member in a sentence, invited, a member since a day with the shares
they hold, suspended or gone, linking to their Membership tab; and,
among its properties, the membership's days and, once taken up,
the first device the invitation enrolled and the day; while they are
invited and have not, the Devices step offers a new link, shown the same
way. Taking an invitation up is the shell's `/join/<secret>` page,
through `accept`, which the feat's slice serves it as `joins`, so the
shell names no feat; proposing their admission,
suspension or exclusion is `membership-motion`'s. A member's own
page offers them Withdraw, which asks them to confirm and signs
`withdraw`; no one else's page offers it. Once they have left, their own
page offers them Erase my data instead, which says what the law keeps,
asks them to confirm and signs `erase`. Seats and powers are this
feat's `membership/seats` ([seats](#seats)).

A person's page has an Authority tab: what they may do on the verdict date,
power by power, each as `circle_person.may` and `circle_person.entitled`
answer it and through what. A power held by a seat names the circle it
is held in, the role, the tenure that holds the role, from and until,
or the seat alone for the participant's, and the mandate, with its
limit per write, or its budget and its period, said to be unchecked,
since `may` checks no budget yet, and what it covers, the whole coop,
a circle or the seat's own circle, each mandate linking to its page and
its chain ([the shell](../../core/circle/index.md#shell)). A power
held twice, by two seats or two mandates, lists each. A power held by a
right names what the person is, person, member or employee, that gives
it, and covers what is their own. It reads `circle_person.holds` and
`circle_person.rights`, the two places a person's mandates and rights are
read, and joins them only to the tenure, the circles and the mandate or
right they name, so it lists exactly what the guard grants. Whoever
reads the person's seats reads the mandates they hold by them; their
rights the person reads on their own page, member or not, by
`circle_person.rights`, and a member reads them on anyone's, while a
non-member reading another's page reads none, and no reader learns
from the tab a right they neither hold nor read as a member ([who
reads it](../../core/circle/index.md#who-reads-the-structure)).
A tab with no line says "No power you may read on this day", which is
true of a person who holds none and of a reader who may read none of
another's.

Beside it, the page gains two tabs. Joining lists what joining asks, step by step,
each kept by the slice that knows it: the membership's own, invited and
then admitted, and a device that signs; the admission once a probation
ends (`employment-membership-motion`); the texts to read
(`document-membership`); the circles ([seats](#seats)); and the
capital (`account-membership`). Membership reads back in plain
sentences what membership is, one member, one vote; what the member owns,
from the statutes' terms (`account-membership`); and what they decide,
from their seats and mandates ([seats](#seats)); and holds what the
member owns in figures: their capital (`account-membership`), what they
paid in and drew (`account-membership-transaction`), their instalments
from pay (`account-membership-payslip-transaction`), their work share
statements (`account-membership-patronage-transaction`) and the
projects' budget shares they hold (`membership-project`). Each slice writes its
sentences from its own guards and parameters, so the page says what the
guards say. For a person who is no member, both say what joining would be.

In the inbox, core's person's, the membership adds their invitation
while they are invited, to take up on their Membership tab.

## Import

Members from another tool's list, a CSV with the columns `address` (or
`email`) and `name`: the importer `members`, each line an invitation
with no link, whom the importer gives a link from their page
([import](../import/index.md)). A row without an address or a name is
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

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `membership.members` to the analytics shell: each member's standing, shares and days, by address. It is scoped by `circle`, the circle that owns the member's row, and by `address`, whose row it is. Its view is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
