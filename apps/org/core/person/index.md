+++
title = "Person"
updated = 2026-11-13
+++

Everyone the co-op knows, by the address they sign with, and their
devices. A person is who someone is, whatever they hold: their name, how
to reach them and the keys that sign their writes. People are org's
core, as circles are ([people are
core](../../../../_corpus/doc/architecture.md#people-are-core)):
`apps/org/core/person` is a core feat of org's core with SQL, a shell
slice and actions of its own, and every feat and graft may reference
its schema, `person`, as it references `circle`. What a person holds is
the feats': a membership is `membership`'s, an employment is
`employment`'s and a contact the co-op keeps is `contact`'s, each a feat
whose rows name a core person, as a feat's rows name a circle. Nothing
can be signed without a person, and no feat is needed for one.

## Why core

Members and workers are one person seen two ways. Inès is hired before she
is invited; Paul was a member and a worker and left as both. Every feat
then comes to name people: a comment's author, a mention, a task's
assignee, an expense's claimant. Kept as a node, the person was readable
only by its children, and every other feat reached a person through a
graft with membership. Here the person is core, and every feat reads it
as it reads circles: membership and employment are feats of the app,
each reading the person and their devices, neither knowing the other,
and the graft joining them is the app's (`apps/org/grafts/employment-membership`).
A person's roles are derived. They are a member if they hold a
membership and a worker if they hold an employment, and a person may hold
both, either or, as a contact, neither. Core knows no feat: what a
membership or an employment is, who holds a right by them, and what
bars a seat of theirs, is registered by those feats. Who may act is
core's, beside the seats, the tenures and the people: whether a seat
counts, the authority every read asks and the guard on every power are
core's graft joining the people to the circles
([who may act](../grafts/circle-person/index.md#who-may-act)), and a
motion's roll is counted by it, so membership keeps the shares, the
capital, the joining and the leaving, and no authority.

```mermaid
flowchart BT
  person["core/person: people, devices, the keyring, the inbox"]
  membership["feats/membership"]
  employment["feats/employment"]
  contact["feats/contact"]
  graft["grafts/employment-membership"]
  membership --> person
  employment --> person
  contact --> person
  graft --> membership
  graft --> employment
```

## Entities

| Entity | Fields | Notes |
|---|---|---|
| person | `address`, `name`, `email?`, `phone?` | the address is the person's for good, the pseudonym every entry names them by |
| device | `key`, `address`, `label`, `enrolled`, `enrolled_by?`, `revoked?` | `key`, the Ed25519 public key, is the device's id; `address` is the person's |
| guardian | `address`, `guardian`, `share_commitment` | who holds a share of the person's recovery secret; not built |
| recovery | `address`, `new_key`, `shares[]`, `opened` | a recovery in progress; not built |

A person comes in through a feat's write: an invitation
(`membership`), a hire (`employment`) or a person contact (`contact`)
names them by address and makes them a person if no one holds it yet
(`entering`, in the feat's own transaction), a contact with the email
and phone it gives. Someone already known keeps their name and details,
so a worker invited to join, or a member who is a client's contact, is
the same person, not a second one.

Device keys are Ed25519, generated on the device with WebCrypto; the
private key never leaves it. The devices are the keyring that checks every
signature, so every reader reads them, signed in or not, by a policy
declared shared (`'shared: why'`), beside core's
row-level policy, which reads every other person record by its circle
([reading](../circle/index.md#reading)). The scope's own key, at the root, is Ed25519
too: the notary signs receipts and log entries with it, read from a file
only the database superuser can read. No signature is post-quantum yet.
Every signed artifact names its binding (the parent, a sequence, its
audience) and each signed type is domain-separated, so a signature on one
thing never verifies another.

## Devices

```mermaid
stateDiagram-v2
  direction LR
  [*] --> enrolled: enrol (signed by a current key), a hire, an invitation taken up or recover
  enrolled --> revoked: revoke
```

A person's first device comes with what brings them in. A hire enrols
the worker's at once, so they sign their own time from their first day.
An invitation is taken up by its link: the invitee's browser makes their
first device, which signs the acceptance that enrols it. Either way the
first device names
no device that enrolled it, and so do the devices of people the seed
loads from before the log. Each later device is enrolled by one of the
person's current keys. A person who has lost every device recovers from
their guardians' shares, which enrols a new key under the same address;
recovery is not built.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/person/profile` | confluent | a person's own fields |
| `POST /api/person/forget` | ordered | erasure wins over every update |
| `POST /api/person/enrol` | ordered | a stolen key must not enrol a device that survives its own revocation |
| `POST /api/person/revoke` | ordered | ordered against that device's writes |

- **profile** sets a person's own name, email or phone.
- **forget** erases a person's own contact details.
- **enrol** adds a device, signed by a current key of the same person. It
  is ordered against revoke: enrol-then-revoke and revoke-then-enrol must
  not end differently, and without an order a stolen key could plant a
  device the revocation does not reach. Enrolment is rare and cheap to
  order.
- **revoke** ends a device. It is ordered against that device's writes: a
  write signed by the key and received before the revocation stands; one
  received after is refused. A person revokes a device from another of
  their devices: the keyring reads the write's own state, so a device
  revoking itself is no longer current when the notary checks it.
- **recover** enrols a key from a threshold of guardian shares, with the
  secret split by cella's secret app. It is ordered because two recoveries,
  or a recovery and a revocation, must not both stand. Not built, so
  not declared: `POST /api/person/recover` comes with the guardians, and
  with the power it needs and the mandate that grants it.

Erasing all of one's own personal data, once one has left the co-op, is
every person's right, `erase-own-data`, taken as a membership's write
(`membership:member:erase`); no one erases another, and no motion decides
it. A worker who was never a member is not erased yet.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| profile | `keep-profile`, every person's right: their own | everyone |
| forget | `keep-profile`, every person's right: their own contact details | everyone |
| enrol | `keep-devices`, every person's right: their own current key | everyone, for their own devices |
| revoke | `keep-devices`, every person's right: their own key; `revoke-key` for anyone else's, not built | Julien, for a lost device reported by phone |
| recover | not built, and not declared until it is: the guardians' threshold, with the power it needs and the mandate that grants it | a threshold the assembly sets |

`003-powers.sql` registers each action's power, so none is allowed by
omission: the four a person takes on what is their own need a power
every person's right grants ([rights](../circle/index.md#rights)),
checked by core's guard on every power (`circle_person.empowered`), and this core's guards check
what they keep is theirs.

## Schema

`person` (`sql/`):

- `person.person`, one row per address, with the name and the optional
  email and phone. The app role may select, insert and update the name and
  contact details; the guards role, `cella_guards`, may select.
- `person.device`, one row per device by its public key, with its address,
  label, the day it was enrolled, the device that signed its enrolment
  (none for a first device) and the day it was revoked. A trigger keeps a
  device's key, address and enrolment fixed and a revocation standing,
  raising SQLSTATE `09000`. The app role may select, insert and update;
  the guards role may select.
- `person.rights`, who holds each right, one row a right with the
  function `(address, day) → boolean` that says whether an address is
  one of its people on a day: `person.known` for every person, which
  this core registers, and the active members and those employed, which
  `membership` and `employment` register by
  `person.register_right(name, fn, owner)`, so this core knows neither
  by name. `person.holds(actor, right, day)` asks it, calling the
  function by its schema and name with its arguments cast to the types
  it was registered with, so a function overloaded under its name runs
  the overload registered: only a person the co-op knows holds any
  right, and no one a right nobody registered.
  The app role and the guards role may select it; only the migrations
  register.

Every feat's and graft's SQL may read this schema, as it reads `circle`:
membership enrols the device an invitation's acceptance makes, and employment
the one a hire carries; a person contact's `person` is a foreign key into
`person.person`, and the contact feat's `contact.named` reads a person's
name, email and phone from it.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.
`person.rights` is a registry and names none. This core knows no
circle, so it names the column as text: core's graft joining the
circles to the people binds it to them, a foreign key and the assembly
by default, and puts the tables under the circles' row-level policies
([circle-person](../grafts/circle-person/index.md)).

## Personal data

`004-personal.sql` registers in `cella.personal`, by the person's address:
the name, of class `profile`, and the email and phone, of class `contact`;
and each device's label, its holder's wording, of class `profile`.
The address itself is the pseudonym every entry names the person by,
commented not personal, and so is a device's. A write carrying any of them
marks it, so the log commits to it and the vault keeps it. The register of
the staff keeps a copy of a worker's name, of class `payroll`, which is
employment's. Erasing a person contact (`contact:contact:erase`) erases
their person's class `contact` with the contact's own data, and leaves
their name, of class `profile`.

## Guards

- `person.own_profile`, on `person:person:profile`: the profile is the
  actor's own (`cella.actor()`).
- `person.forgets`, on `person:person:forget`: the actor erased their own
  contact details, and nothing more.
- `person.verifies(actor, device)`, the scope's keyring, registered in
  `cella.keyring`: the device is enrolled, under the actor's address, and
  not revoked. `cella.submit` calls it for every write, after checking the
  signature and before any guard, under the log's head lock.
- `person.enrols`, on `person:device:enrol`: the address is the actor's,
  and the device was enrolled by this write, naming the signing device
  (`cella.device()`) as `enrolled_by`.
- `person.revokes`, on `person:device:revoke`: the device is the actor's,
  and was revoked by this write.

## Folds

Each action that writes the feat's schema says how its entry applies to
the state before it (`sql/007-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)), at version 1:

- `person:device:enrol` (`person.fold_enrol`) inserts the device by the
  key, address and label's commitment its entry carries, enrolled on the
  entry's day by the device it names as `by`; an entry that enrolled
  none, a key enrolled already, inserts none.
- `person:device:revoke` (`person.fold_revoke`) revokes the device on
  the entry's day, unless it was revoked already.
- `person:person:profile` (`person.fold_profile`) writes each field its
  entry names as its commitment.
- `person:person:forget` (`person.fold_forget`) writes nothing: its
  erasure folds as the notary carried it out.
- `membership:member:invite` and `employment:worker:hire`
  (`person.fold_entering`, `person.fold_hire`) enter a person new to the
  scope by their name's commitment, an invitation's `name` or a hire's
  `entered`; one the scope knew already is left as they were.
- `contact:contact:add` (`person.fold_contact`) enters a person contact
  new to the scope, at the address its `values` name, by the
  commitments to their name, email and phone its `entered` carries; a
  company, or a person the scope knew already, carries none and enters
  no one.
- `membership:member:accept` and `employment:worker:hire`
  (`person.fold_enrolling`) enrol a first device by its key and its
  label's commitment, an acceptance's `device` or a hire's `label`, on
  the entry's day, enrolled by no device.

## Handlers

- `profile` (confluent): sets the person's given fields, name, email or
  phone, and submits `{ person, fields, values }`, each value marked
  personal, so the log keeps a commitment to it.
- `forget` (ordered): submits `{ person, erasure }`, the erasure of the
  person's own contact details.
- `enrol` (ordered): inserts the device on the verdict date, enrolled by
  the device that signed the write; submits `{ address, key, label, by,
  enrolled }`, the label as its commitment and `by` the signing device.
- `revoke` (ordered): sets the device's `revoked` to the verdict date.
- `entering`, no write of its own: what an invitation, a hire or a
  person contact runs in its transaction to bring a person in, with the
  email and phone a contact gives, telling the feat whether the person
  is new, so its payload commits to what it gave only then.
- `enrolling`, no write of its own: what a hire or an invitation taken up
  runs in its transaction to enrol the person's first device, on the
  verdict date and by no device, refusing a key enrolled already. A
  child changes the person's rows only through `entering` and
  `enrolling`.

Signing is the client's, `@cella/org-sign` in org's core.

## Invariants

Core's person owns:

- a device belongs to one address, for good;
- an enrolment is signed by a key of that address that was current at its
  receipt, or by a recovery, a hire or an invitation taken up, which the
  device it enrols signs;
- a revoked key verifies nothing received after its revocation;
- the scope's thresholds are signed policy in the log, never a flag.

What it does not own: whether the person behind an address may act at all
(a suspended or exited member's keys still verify; the permission check
refuses them).

## Shell

The `people` collection in Governance: everyone the co-op knows, by name.
Each feat that holds what a person holds adds its chip, a badge column to filter and group by: Member,
the membership's status, and Worker, employed or left. The New form is the
feats': an invitation and a hire, each under its title. A person's
page holds their address and devices, with the profile write on it; the
feats add their membership's and employment's properties and tabs
(Joining, Own and decide, Powers, Employment), and the grafts joining
them the rest, each in the tab of the slice it joins or in one of its
own: Records, Tasks and Expenses. The
`devices` collection, in Settings under Personal, lists every device,
current ones first. On a person's
own page the device their session signs with is marked as this device,
and each other current one has its revoke, signed from this one; with
none, the page says it is their only device. The same fields and
devices are the acting person's Account settings, `/settings/account`
([settings](../ui/index.md#settings)), which this core's `./app`
mounts in the Settings section, saving the name, email and phone by
`profile`. Enrolling a later device
from a current one is not offered yet. The dev server signs as a person with a
device's TEST-ONLY fixture key only when it is the key enrolled under that
label and not revoked.

The `inbox` collection is what waits on the acting person, at the head of
the sidebar with its count, each row linking to where it is done. It is
core's, as the person it waits on is: this core keeps it, its `./api`
and `./app` slices serve it to the shell, and it adds nothing of its own; each slice that knows a kind
adds its rows (`rows`): an invitation to take up (`membership`), a stance
to take on an open motion (`membership-motion`), a mention not
yet answered (`membership-motion`), a meeting to say whether they will
come to (`meeting-membership`), time, expenses and pay runs to
approve or pay (`membership-timesheet`, `expense-membership`,
`membership-payslip`). An ask is a row of its kind, what it says,
what it concerns, since when and by when (`models/inbox.ts`); it leaves
the inbox when what it waits for is done, read again each time, and
nothing of it is stored.

## Lanterne

- Thirteen people: ten members, Paul, who left, Inès, employed and
  invited, not yet a member, and Margaux Roux, Les Halles' contact, who
  holds nothing and has no device (`person.toml`).
- Fifteen live devices: four people have a laptop and a phone. Their keys
  are TEST-ONLY, derived from each device's address and label, so the seed
  and the tests hold the same keys.
- Hugo's old laptop was revoked on 12 May 2026: it signs nothing now.
- Inès signs with the laptop her hire enrolled, and with the phone on
  which she took up her invitation on 1 October.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `person.people` to the analytics shell: each person by address, with their name, which erasure redacts. Contact details are not shared. It is scoped by `circle`, the circle that owns the person's row, and by `address`, whose row it is. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
