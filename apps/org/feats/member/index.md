+++
title = "Member"
updated = 2026-10-25
+++

A person's membership, from invited to exited. Members records who belongs; it decides nothing.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/member/invite` | confluent | a fact; two invitations do no harm |
| `POST /api/member/admit` | ordered | changes who votes |
| `POST /api/member/profile` | confluent | a member's own fields |
| `POST /api/member/suspend` | ordered | changes who votes |
| `POST /api/member/exit` | ordered | freezes the capital account |
| `POST /api/member/erase` | ordered | erasure wins over every update |
| `POST /api/member/forget` | ordered | erasure wins over every update |

## Powers

Nothing is allowed by omission: each write needs a power or declares its
check.

| Write | Power or check | Lanterne |
|---|---|---|
| invite | `invite-member` | every member, through the assembly's `member` role |
| admit | decided: the cited decision admits the member and carried | the assembly, by consent |
| profile | self: the member's own | every member |
| suspend, exit | decided: the cited decision suspends the member, or ends their membership, and carried | the assembly |
| erase | decided: the cited decision erases a member who has left, and carried | the assembly |
| forget | self: the member's own contact details | every member |

`004-powers.sql` registers invite's power in `cella.power`; the decided
writes are listed in `decision.cites` by the `decision-member` graft.

## Schema

`member` (`core/sql/`): `member.member`, one row per address, with name, optional email and phone, status (`invited`, `active`, `suspended`, `exited`), `since` (admitted) and shares, and the days it was `invited`, `suspended` and `exited`. A trigger lets a status move only along that lifecycle, raising SQLSTATE `09000` otherwise. The app role may select, insert and update; the rules role, `cella_rules`, may select.

## Personal data

`006-personal.sql` registers in `cella.personal`, by the member's
address: the name, of class `member-profile`, and the email and phone,
of class `contact`; the address itself is the pseudonym every entry
names the member by, commented not personal. A write carrying any of
them marks it, so the log commits to it and the vault keeps it.

## Rules

- `member.invites`, on `member:member:invite`: the write invited the member, on the verdict date.
- `member.admitted`, on `member:member:admit`: the write left the member active, since the verdict date, holding shares. The `decision-member` graft runs it again for each member a decision's close admits.
- `member.own_profile`, on `member:member:profile`: the profile is the actor's own (`cella.actor()`); a profile needs no power.
- `member.ends`, on `member:member:suspend` and `:exit`: the write left the member suspended, or exited, on the verdict date.
- `member.erases`, on `member:member:erase`: the member has left, and the write erased every class of their personal data, at once or restricted.
- `member.forgets`, on `member:member:forget`: the actor erased their own contact details, and nothing more.

Whether the cited decision asks it is the `decision-member` graft's rule on the same ops; whether it closed and passed on its roll, `circle-decision-member`'s.

## Handlers

- `invite` (confluent), and `inviting`, the same as a write a graft extends in its transaction: inserts the member invited on the verdict date, holding nothing; submits `{ member, invited }`, the name left out. The `key-member` graft replaces it in the shell with an invitation carrying the invitee's first device.
- `admit` (ordered), and `admitting`, its state alone, which the close of the deciding decision runs in its own transaction: makes an invited member active since `cella.verdict_date()` with their shares; a member not invited is left as they are, for the rules to refuse. Submits `{ member, shares, decision }`.
- `suspend`, `exit` (ordered): set the status and its day; submit `{ member, decision }`. `circle-decision-member` carries them out when the decision that asks them passes.
- `profile` (confluent): sets the member's given fields, name, email or phone, and submits `{ member, fields, values }`, each value marked personal, so the log keeps a commitment to it.
- `erase` (ordered): submits `{ member, decision, erasure }`, the erasure of every class of the member's personal data, which the notary carries out as it settles: the name and contact details deleted from the vault and redacted here, payroll, receipts and the books restricted until their clocks run out. `circle-decision-member` carries it out when the decision that asks it passes.
- `forget` (ordered): submits `{ member, erasure }`, the erasure of the member's own contact details.
- The invitation's payload commits to the invitee's name.

### The exit's hook

An exit freezes the member's capital, which is the books', not this
feat's. The exit sets `status` to `exited` and `exited` to the verdict
date in its own transaction, and its payload names the member and the
decision: a graft joining `member` to the books (`account-member`)
attaches a trigger to that update, or a rule to `member:member:exit`, and
so settles or is refused with the exit itself. A reaction to the settled
op in a slice's `on` runs only for a write made from a page, not for one
a close carries out, so the freeze belongs in SQL.

## Grafts

- `decision-member`
- `document-member`
- `key-member`

## Shell

The `members` collection, by name; its New form, an invitation, is
`key-member`'s, which carries the invitee's first device. A member's page
shows the days the membership moved and renames them (`profile`), which
`member.own_profile` refuses for anyone but the actor; proposing their
admission, suspension or exit is `circle-decision-member`'s. Seats and
powers are `circle-member`'s, devices the `key` feat's.

A member's page has three tabs. Overview holds what the slices show of
the member. Joining lists what joining asks, step by step, each kept by
the slice that knows it: the membership's own, invited and then
admitted; the admission once a probation ends (`decision-member-worker`);
the texts to read (`document-member`); the circles (`circle-member`); a
device (`key-member`); and the capital (`account-member`). Own and decide
reads back in plain sentences what membership is, one member, one vote;
what the member owns, from the statutes' terms (`account-member`); and
what they decide, from their seats and mandates (`circle-member`). Each
slice writes its sentences from its own rules and parameters, so the
page says what the rules say.

The `inbox` collection is what waits on the acting member, at the head
of the sidebar with its count, each row linking to where it is done.
This feat keeps it and adds the member's invitation while they are
invited, to take up on their Joining tab; each slice that knows another
kind adds its rows (`rows`): a stance to take on an open decision
(`circle-decision-member`), a mention not yet answered
(`decision-member`), a meeting to say whether they will come to
(`circle-meeting-member`), time, expenses and pay runs to approve or
pay (`circle-member-timesheet`, `circle-expense-member`,
`circle-member-payslip`). An ask is a row of its kind, what it says,
what it concerns, since when and by when (`models/inbox.ts`); it leaves
the inbox when what it waits for is done, read again each time, and
nothing of it is stored.

## Domain

Ported from seedling's `specs/feat/10-members.md` under this repo's labels
and grafts. A candidate's probation is `member-worker`'s, since it is
served in employment; leave and member categories are not built.
