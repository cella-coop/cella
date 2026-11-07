+++
title = "Circle"
updated = 2026-11-07
+++

Core's circles: the co-op's structure and the authority that flows
through it, which every feat builds on, as groups are in standard RBAC.
It is a library of org's core, `apps/org/core/circle`, and no feat: its
tables are in the `circle` schema, which every feat's and graft's SQL
may reference as it references `cella.*`, and its actions are core's. A
circle is a self-governing unit, after sociocracy: the general assembly, a
coordination circle, a working team: its members and a decision rule,
acting jointly by motion. Circles never nest: the assembly is one circle
beside the others, and what is under a circle is what it issued, the
mandates' provenance, never where it sits. Each circle defines roles, and
grants powers to them through mandates, each perhaps scoped to the
resources it covers; a person holds a role by a tenure, and a circle counts people
and roles among its members, and where each sits is read from the two
([seats](#seats)). A mandate's grantee is one circle or one role, never a person.
Each circle also has a channel for its messages.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| circle | `id`, `name`, `assembly`, `purpose`, `procedure` | `assembly` marks the general assembly, one circle and only one, which holds every power inherently; no circle contains another; `procedure` names the procedure its motions are decided by where nothing they act under asks another: consent, majority, two thirds or one of the co-op's own, which the motion feat holds and checks |
| role | `id`, `circle`, `name`, `duty`, `holders?` | `circle` is one circle, or `*` for a role every working circle has; `holders` caps how many hold it at once in a circle, one gérante or one lead a circle, none uncapped; `participant`, built in, is every circle's, the assembly's too |
| grantee | `id`, `kind` | what a mandate is granted to: a `circle` or a `role`, by its id, one row for each, made as the circle or the role is, so circles and roles share one key |
| mandate | `id`, `grantee`, `issuer`, `parent?`, `power`, `policy`, `limit?`, `budget?`, `per?`, `procedure?`, `scope?`, `from`, `until?`, `revoked?` | the values of the mandate policy `policy` that grants it: its `grantee` is a role, an individual mandate, or a circle, a collective one; `issuer` is the circle whose motion adopted it, and `parent` the mandate it is issued under, none for one the assembly issues; `power` is an id; `limit` caps a single write, in cents, `budget` caps a cumulative total over its `per` ("month" or "year"); `procedure` names the procedure a motion acting under it is decided by, which passes down to every mandate issued under it, by name, since the motion feat holds procedures; `scope` is the condition on what it covers, a circle's id or `own`, the circle its holder holds the role in, none for the whole co-op; `from` and `until` are the days its policy applies |
| right | `id`, `right`, `power`, `policy`, `limit?`, `from`, `until?`, `revoked?` | the values of the right policy `policy`: a power the legal form gives every `person`, `member` or `employee` as such; no mandate, so no grantee |
| message | `id`, `circle`, `thread?`, `author`, `at`, `text` | the circle's channel |

A **power** is the id of something a write needs, such as `issue-invoice`
or `close-period`; the feat owning a write names the power in
`cella.power`. A mandate grants one power to one grantee, a role or a
circle, by one key and never to a person, with an optional limit, for a
term. Who holds a role is a tenure, and where they sit by it a seat
([seats](#seats)). Whether an actor may use a power is the membership
feat's guard, `membership.may`, since whether a seat counts on a day is
membership's to say: an actor may if a seat they hold on the day carries
a role with a mandate in force for the power, within its limit, the
circle's participant role among them. A power every member holds in a
circle is granted the same way, through a mandate on a role every member
is seated in, such as a `member` role in the assembly: nothing is
allowed by omission. A mandate on a circle itself, a collective mandate,
is no seat's: it is used only by a motion of that circle ([collective
mandates](#collective-mandates)). A right is no mandate: the legal form
gives it to every person, member or employee as such, to act on what is
their own ([rights](#rights)).

## Mandates

A mandate is a policy, a sentence a circle adopted by motion
([policies](../../../../_corpus/doc/architecture.md#policies)), its
values marked in it: its grantee, the role it grants to or the circle,
the power, perhaps a limit per write or a budget over a month or a
year, and perhaps its scope.

```text
The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 3 000 €} a write
The {role: lead} role holds {power: approve-expense}, to approve what the circle's members spend, within {budget: 1 000 €} a {per: month}
The {role: lead} role holds {power: manage-project}, to start and run the projects of its {scope: own} circle
The {circle: ag} circle holds {power: admit-member}, to admit members, by motion
The {circle: web} circle holds {power: adopt-policy}, to adopt its own policies, by motion, by {procedure: consulted}
```

Its term is its policy's days: it applies from the day its motion names
or its verdict, and until the day it names, if any. Granting a mandate
is adopting its policy, and its values are copied into `circle.mandate`
in the same write, so `membership.may` reads a column, never the
sentence; revoking one is ending its policy, which revokes its mandate
on the verdict date. A mandate policy replacing another revokes the
other's mandate the day it applies. Either revocation revokes every
mandate issued under the one revoked, down its provenance tree, the
same day ([revocation](#revocation)). The copy is core's, by
`circle.mandate_from(policy)` and `circle.mandate_ended(policy)`, which
read the register's values and never its wording; the write that calls
them is the motion feat's adoption and ending of a policy. What a
mandate's values may be is core's too, `circle.mandate_flaw(marked)`: one grantee, a role it has
or a circle it has, a power named in lower case, at most a limit or a
budget, an amount, a budget with its `per`, perhaps a procedure by name,
perhaps a scope, a circle it has or `own`, and no other value.

A mandate's scope is a condition on its permission, the resources it
covers, never a place in a tree: one marking `{scope: web}` covers
Web's projects, meetings and time; one on a role marking `{scope: own}`
covers those of the circle its holder holds the role in, so each
working circle's lead covers their own circle's alone; one marking none
covers the whole co-op, every circle's records. Whether a scope covers a
record's owning circle is core's, `circle.covers(scope, held, about)`
(`008-scope.sql`), `held` the circle the holder holds the role in;
ownership grants nothing by itself, only the label a scope is read
against. The one guard that reads it on every action is the membership
feat's, which knows whether each holder's seat counts, `membership.may`
against the circle the write's payload names
([membership](../../feats/person/feats/membership/index.md#seats)). A
mandate's procedure is what the motions acting under it are decided by,
and passes down its chain: the motion feat, which knows procedures, holds it to one at least as strict as its
parent's chain asks and fixes each motion's by it
([requirements](../../../../_corpus/doc/architecture.md#policies)). A
mandate naming a person (`{person: …}`) is refused, since a person holds
a role by a tenure and the role holds the mandate; so is one naming a
right, which is a policy of its own kind.

A mandate is issued under a parent and is narrower than it
([authority](#authority)): its issuer is the circle whose motion adopted
its policy, and its parent a mandate the issuer holds as a whole for the
same power, found as the policy is adopted, so a motion of coordination
granting Web's lead `approve-expense` grants it under coordination's own
`approve-expense`. A mandate the assembly issues has no parent.

## The default bundle

A new circle comes with its default mandate bundle: its members read its
records and its roles act on them from the day it is created, with no
further motion. The bundle is every mandate in force on the roles every
circle has (`*`): the participant's, which every seat in a circle holds
there, and those of the lead, the secretary and any other `*` role a
co-op defines. Each is a mandate policy of the assembly like any other,
its values copied into `circle.mandate` as it is adopted, never parsed
from its wording, so the bundle is a template each co-op changes by
motion of the assembly: adopting a mandate on a `*` role adds to it,
ending or replacing one takes from it.

```text
The {role: participant} role holds {power: read}, to read the records of its {scope: own} circle
The {role: lead} role holds {power: manage-project}, to start and run the projects of its {scope: own} circle
```

A mandate on a `*` role scoped `{scope: own}` covers, for each holder,
the circle they hold the role in, so one mandate reaches every circle,
the new one among them, the day someone sits there. Creating a circle
issues the bundle in force on its verdict date: the creation's entry
names each mandate in it (`circle.bundle(day)`), so the log says what a
circle was created with. A later change to the template reaches every
circle, those created before it too, since they hold the same mandates.
A role made for one circle holds only what a motion grants it.

**Open books** is one mandate of the assembly, no part of the bundle:
`The {role: member} role holds {power: read}, to read every circle's
records`, marking no scope, so whoever holds the member role, every
active member, seated in the assembly, reads every circle's records
([reading](#reading)). A co-op that keeps its books closed adopts none,
and its members read their own circles' records and what the law gives
them. What every member reads of the totals of members' own figures,
their pay, time, capital, work share and expenses, is open books'
disclosure rule ([below](#open-books)).

## Collective mandates

A mandate on a role is individual: whoever holds that role by a tenure
uses it, each holder alone. A mandate on a circle is collective: the circle holds it as a
whole and uses it only by motion, so no seat brings it. An action a
passed motion carries, such as admitting a member, adopting a policy or
giving a seat, needs the power a collective mandate grants, and
takes effect only where the motion's circle holds one for that power:
`circle.holds(circle, power, day)`, which reads the circle's own
mandates, never another circle's. The action's
power is registered with it in the motion feat's `motion.cites`, and
the motion feat checks it when the motion is proposed and again when
each action is carried out ([motion](../../feats/motion/index.md#circles)).

| Power | Actions |
|---|---|
| `admit-member` | admitting a member (`membership:member:admit`), and the subscription that follows (`account:capital:subscribe`) |
| `suspend-member` | suspending a member (`membership:member:suspend`) |
| `exclude-member` | excluding a member (`membership:member:exclude`), and the freeze and withdrawal of capital that follow (`account:account:freeze`, `account:capital:withdraw`) |
| `adopt-policy` | adopting a policy (`motion:policy:adopt`), granting a mandate among them, and the copies into terms and the statutes that follow (`account:terms:adopt`, `patronage:terms:adopt`, `document:document:generate`) |
| `end-policy` | ending a policy (`motion:policy:end`), revoking a mandate among them |
| `approve-distribution` | approving a year's distribution (`patronage:distribution:approve`), and the posting and the parts employed that follow (`patronage:distribution:distribute`, `patronage:part:employ`) |
| `adopt-document` | adopting a document's version (`document:document:adopt`) |
| `seat-member` | giving and ending a seat (`circle:seat:add`, `:remove`) |
| `create-circle` | creating a circle (`circle:circle:create`) |

Whom a circle's motion decides about is `motion.decides`, and
never where a circle sits, since none nests: the assembly decides about
every circle, itself included, and any other circle about every circle
but itself and the assembly, so a circle's own seats and powers are
another's to decide. What it may grant is what it holds to issue under
([authority](#authority)), and what it may revoke what it issued or
what was issued under that.

## The participant role

Every circle has a participant role, built in: the role `participant`,
whose `circle` is `*`, which core's migration makes, so no circle
is without it. Every seat in a circle holds it there, beside the seat's
own role if it has one; a seat in one circle brings no participant role
in another, so a member of the assembly is no participant of Marketing unless they
sit in Marketing too. The participant's mandates cover proposing and
discussing:

| Power | Actions |
|---|---|
| `propose` | proposing a motion of the circle (`motion:motion:propose`) and closing it (`motion:motion:close`) |
| `discuss` | posting on a motion's deliberation (`motion:message:post`), in the circle's channel (`circle:circle:message`), and adding, moving and removing an item of its meetings' agendas (`meeting:item:add`, `:move`, `:remove`) |

They are mandates like any other, each a policy, and since the role is
every circle's (`*`) they are the assembly's to grant and hold in every
circle. `membership.may` finds a participant's mandate on any seat
the actor holds; the guard of the slice that knows which circle an
action concerns (`membership.sits`, `membership_motion.sits`,
`meeting_membership.sits`) asks for a seat in that circle. An
agent's or a service's seat would bring no participant role unless a
procedure says so: named, not built.

## Rights

A right is no mandate: it is what the legal form gives every person
(`{right: person}`), every member (`{right: member}`) or every employee
(`{right: employee}`) as such, never an agent or a service, so it has
no grantee, no issuer and no chain. It is a policy of its own kind,
`right`, which the form offers and the founding motion adopts with the
statutes, and its values are copied into `circle.right` as it is
adopted, as a mandate's are into `circle.mandate`, by the same
`circle.mandate_from`; what they may be is `circle.right_flaw(marked)`:
one right, a power, at most a limit, and no other value. Who is one of
them on a day is person's core's to say, `person.holds(actor, right,
day)`, by the function each kind of person registers there: `person`
the people the co-op knows, `membership` its active members,
`employment` those employed. The membership feat's guard on every op
with a power takes a right, `membership.entitled`, beside the
mandates on the actor's seats, so Inès, employed and no member, holds an
employee's rights beside the mandates of her seat in Web, and Paul, gone
since 30 November 2025, a person's alone.

A right lets each act on what is their own: the feat's guard that the
record is theirs stays, and a right is never the authority a read asks
(`membership.covered`), so it opens no one else's rows. It reaches the
whole co-op, is issued under no mandate, and no mandate is issued under
it.

| Right | Power | Actions |
|---|---|---|
| person | `keep-profile` | their profile (`person:person:profile`) and erasing their contact details (`person:person:forget`) |
| person | `keep-devices` | enrolling and revoking their devices (`person:device:enrol`, `:revoke`) |
| person | `upload-file` | uploading a file of the co-op's (`file:file:upload`) |
| person | `accept-invitation` | taking up their invitation (`membership:member:accept`) |
| person | `file-record` | filing a record of their own (`file-membership:member:attach`) |
| person | `mark-read` | marking a text the co-op adopted read (`document-membership:version:read`) |
| person | `record-import` | recording an import of their own (`import:run:record`) |
| person | `withdraw-membership` | withdrawing their own membership, and the freeze and withdrawal of their capital that follow (`membership:member:withdraw`, `account:own:freeze`, `account:own:withdraw`); worded on every person, since the withdrawal ends the membership on its own verdict date, and held to a member's own by the membership feat's guard |
| person | `erase-own-data` | erasing all their own personal data once they have left (`membership:member:erase`), within the holds the law keeps; held to their own, and to one who has left, by the membership feat's guard |
| member | `draw-account` | drawing on their account within its draw limit (`account:account:draw`) |
| member | `spread-capital` | spreading what they owe over their pay (`account:capital:spread`) |
| member | `mark-attendance` | marking their attendance at a meeting (`meeting-membership:attendance:mark`) |
| member | `save-report` | saving a report of their own (`report:report:save`) |
| employee | `log-time` | logging, correcting and submitting their own time, booked to a project or not (`timesheet:entry:log`, `:entry:correct`, `:period:submit`) |
| employee | `claim-expense` | claiming an expense and submitting it, attaching its receipt and filing it on a project (`expense:expense:capture`, `:submit`, `expense-file:expense:attach`, `expense-project:expense:rebill`) |
| employee | `apply-membership` | applying to join once employed a year, which puts their admission to the assembly in the same write, and opening their candidacy, which follows it (`membership:member:apply`, `employment-membership:candidacy:open`); held to their own application by the membership feat's guard, and to a year's employment by employment-membership's |

## Reading

Reading follows the mandates: a person reads a record only by a mandate
whose scope covers its owning circle. Reading is the read group,
`read`, a power no action needs: a mandate for it lets its holder read
every record its scope covers, as `{scope: own}` on the participant
role lets every participant read their own circle's records. A power a
feat names as reading its rows in `cella.reading` reads them too, by
its scope, as Expense's `approve-expense` lets Web's lead read Web's
expenses and the gérante's, on the whole co-op, every circle's. Open books, where a
co-op adopts it, is a mandate for `read` on the member role marking no
scope, so every member reads every circle's records ([the default
bundle](#the-default-bundle)). What the law gives every member to read, the year's accounts and the
activity report, needs no mandate, and a person reads what is theirs,
their profile, membership, contract and claims, their pay, time and
capital, by a row-level policy of the table it is in beside core's.

Core keeps it in the database (`009-reads.sql`). `circle.scoped`, an
event trigger, puts each table a feat or a graft makes under row-level
security, enabled and forced, as it is made. One that names an owning
circle takes the row-level policy `circle`, for the app role, and lets
the guards role read the whole: a row reads where its circle is among
those its reader reads in, `circle.reads(feats)`, the circles a mandate
of theirs for `read` covers and those a power the feats name covers
(`cella.circles`, whose authority is the membership feat's), asked
once per query; a write's transaction reads the whole
(`cella.sees`). A table a person's data is in drops it for its own,
which `read` opens nothing of
([architecture](../../../../_corpus/doc/architecture.md#sql)). One that
names none is a registry, the same in every scope, and takes the policy
`registry`, which every reader reads. `circle.unsecured()` names each
table of a slice not enabled and forced, or with no policy the app role
reads it by, and `cella migrate` fails a run that leaves any
([reading](../../../../_corpus/doc/architecture.md#reading)).
`circle.whole()` says whether the session reads the whole, a write's
transaction or a session whose role, the one it set or else its login,
is a superuser: a `SECURITY DEFINER`
function that filters its rows by its reader asks it in place of
`cella.sees`, which there answers for the function's owner.

### Who reads the structure

The co-op's structure is its members' (the operator, 6 November 2026:
"members of the scope read it; a signed-in person who is not a member
reads none of it"): core's circles, roles and grantees, the mandates,
the rights and open books' values, the members and the tenures, and
the [register of policies](../policy/index.md). A member of the scope
holds the member role, `member`, seated in the assembly by a tenure
running on the verdict date (`circle.inside()`), and reads every row of
it. Any other person signed in reads their own: the members that seat
them, as a person or by a role they hold a tenure of, their tenures,
the seats read from them, and the circles and roles those seats name,
by the personal row's pattern
([architecture](../../../../_corpus/doc/architecture.md#reading)),
and the mandates on the roles they hold, the participant's among them
(`circle.held()`), which say what their seats let them do; and
nothing else: no other role's mandates, no circle's, no right and no
policy.
No one signed in reads none of it. A write's transaction and a
superuser's session read the whole (`circle.whole()`), and the guards
role reads every row, as it reads a slice's.

`011-structure.sql` puts each of these tables, the register's with
them, under row-level security, enabled and forced, with the policies
`structure`, for the app role, and `structure_guards`, for the guards
role; the forms and their defaults, the same in every scope, are
registries every reader reads. `circle.seat` reads as its reader, so a
person sees their own seats through it. `circle.inside()`,
`circle.held()`, the roles the reader's seats hold, and `circle.own()`,
the circles and roles they name, run as their owner, so a policy asks
them without reading the table it guards, and say no more than
whether, and of the reader's own seats.
`circle.unsecured()` names core's tables with the slices', so `cella
migrate` fails a run that leaves one not enabled and forced, or with
no policy the app role reads by.

The authority reads past these policies, as it always has: `cella.may`
and `cella.covered` run as their owner, so a person's mandates open
what they cover whether or not they read the mandates themselves, as
Inès, employed and seated in Web, reads Web's records and logs her
time. What a person reads before they are a member, to apply, core
gives them through functions of its own, never a wider policy: the
assembly's id, `circle.assembly()`, which runs as its owner, and its
name and the procedure that decides them, `circle.applied()`, declared
`audience: shared`. Open books' values are what every member reads,
so a report asks them as its reader (`circle.disclosed`), and shows a
person who is no member only their own cells of a counted view.

## Open books

What a co-op shares with every member of the totals of members' own
figures is its choice by motion: a rule of the assembly marking three
disclosure values, by name, each with the way it is stricter, as
Lanterne's reads:

```text
Open books shares a total of members' own figures with every member where at least {disclosure_contributors: 5 | more is stricter} people put into it, none of them more than {disclosure_largest: 50 % | less is stricter} of it and no two more than {disclosure_two: 80 % | less is stricter}
```

- `disclosure_contributors`, a number from 2 to 200: the fewest
  distinct people a total may count. At two, each of the two works out
  the other's exact amount; five is a precaution, not a promise.
- `disclosure_largest`, a share from 20 % to 100 %: the most of a total
  one person may put in. 100 % turns the check off.
- `disclosure_two`, a share from 40 % to 100 %, never below
  `disclosure_largest`: the most two people may put in together. At
  80 % it holds every total the p% rule holds at p = 10 %.

The defaults are those [the disclosure study](../../../../_corpus/review/2026-11-05/disclosure.md)
recommends; the contract fixes none. Core copies them into
`circle.disclosure` in the write that adopts the rule, as it copies a
mandate's values, and ends them with it: `circle.disclosure_from` and
`circle.disclosure_ended`, which `circle.mandate_from` and
`circle.mandate_ended` call, so `granting` and `revoking` carry them
([handlers](#handlers)). A rule marking any of the three is the
disclosure rule: it marks all three and nothing else, only the
assembly adopts it, and one that does not is refused as its motion is
proposed and again as it is adopted, saying what is wrong
(`circle.disclosure_flaw`). A later rule replaces it the day it
applies. `circle.disclosed(day)` reads the values in force on a day,
none where no rule stands.

The analytics port reads them for each run that reads a counted view, a
shared total of members' figures
([analytical contracts](../../../../_corpus/doc/architecture.md#analytical-contracts)),
and withholds from its reader each cell they could not read every row
of, where fewer people than the first value are in it, or one or two of
them put in more than the others allow, or it sums to nothing
([what is withheld](../analytics/index.md#what-is-withheld)). A reader
always reads the cells whose every row is theirs or is in a circle a
power of theirs over the feat's rows covers. Where no disclosure rule
stands, every other cell is withheld: a co-op that adopts none shares
no such total beyond its readers' own rights.

The assembly's page configures them: Open books, the motion feat's,
shows the values in force, proposes new ones or the rule's end as a
motion of the assembly, and says beside each value, as it is typed,
whether it exposes personal data and why, in the disclosure study's
words ([the circles in the shell](../../feats/motion/index.md#the-circles-in-the-shell)).

## Schema

`circle` (`core/circle/sql/`): `circle.circle`, `circle.role`,
`circle.grantee`, `circle.mandate` and `circle.right`, as in the
entities above, and `circle.disclosure`, open books' values by the rule
that marks them, on its days until it is revoked; a role's `holders` is a positive count or none. Every circle and every role is a grantee, its row made
by a trigger as the circle or the role is, so a circle and a role never
share an id and a mandate's `grantee` is one foreign key, as its
`issuer` is; its `parent` is a mandate, so the mandates form a forest
by it, and `circle.chain(mandate)` reads a mandate's chain from its root
down to itself, each with its grantee and its issuer. A mandate's
`limit` and `budget` and a right's `limit` are `cella.amount`s, and each
names the policy that grants it, one a policy. A circle has no parent
and no place: one circle only is the assembly, a unique index holding
it so, and `circle.assembly()` names it. `circle.circle` is what every
record's owning circle keys into: each table of a feat or a graft has a
`circle` column, a foreign key into it, which defaults to
`circle.assembly()`, the root, where a write names none
([architecture](../../../../_corpus/doc/architecture.md#sql)). Triggers keep a
mandate's grant fixed and a revocation standing, a right's as a mandate's,
raising SQLSTATE `09000`. The app role and the guards role,
`cella_guards`, may select; the app role may grant and revoke mandates
and rights. A mandate is in force on a day from its `from`,
before its `until` and before its `revoked`; `circle.holds(circle,
power, day)` asks whether a circle holds a collective mandate in force
for a power on a day, one whose grantee is the circle,
`circle.sovereignty(ending, adopting)` why the assembly would not keep
one for `adopt-policy` in force on the verdict date with no `until`
once the policies `ending` end
and the mandates `adopting` are granted ([authority](#authority)), and
`circle.bundle(day)` names the default bundle on a day: every mandate
in force then on a role every circle has (`*`), by id.

## Seats

Who is in which circle, and who holds which role: a circle's members,
people and roles, and a person's tenures of roles, and the seats read
from them (`007-seat.sql`). Any person may hold a role or be a member
of a circle, member of the co-op or not; whether a seat counts on a day
is the membership feat's to say, since the assembly's asks an active
membership ([membership](../../feats/person/feats/membership/index.md#seats)).

- `circle.member`: a member of a circle, by circle id, and either a
  person, by address, or a role, by id, with no foreign key into a
  feat, and `since` and `until`. A role that is a member of a circle
  seats whoever holds it there (the double link); a `*` role seats its
  holder of every circle.
- `circle.tenure`: a person's time in a role, by `holder` address,
  `role` id and the `circle` it is held in, the role's own or, for a
  `*` role, the working circle, with `since` and `until`. A tenure of a
  role in a circle that is not its own is refused, and so is one that
  would make more holders of the role in the circle at once than its
  `holders` (`circle.capped`, raising SQLSTATE `09000`), so a handover
  ends one tenure on the day the next begins. At once is on one day:
  the cap counts, on each day the tenure spans, the tenures of the role
  in the circle that run that day, itself among them, and refuses only
  where some day's count passes `holders`, never for tenures that
  overlap it on different days. Of two holders at most, one from
  January to February and another from March to April leave room for a
  third from January to April. The refusal names the first day the cap
  would be passed and the cap, so a later `since`, or an earlier end to
  a tenure running that day, fixes it.
- Both draw their ids from one sequence, so a seat's id names one row
  of either. One with no `since` was held before the records began; an
  ended one keeps its row with `until`, so who sat where on a past day
  reads back.
- `circle.seat`, a view: where each person sits, read from the two and
  never stored, by `circle`, `member` (the person), `role`, `since`
  and `until`. A person member sits as such, with no role; a tenure
  seats its holder in its circle with its role; a tenure of a role that
  is a member of a circle seats its holder there too, with no role, for
  the days the two overlap, so the role's mandates reach no further than
  they do. This last row has no id of its own. It reads as its reader,
  so it shows what the members and the tenures let them read.
- `circle.seated(circle, day)`: the people seated in a circle on a day,
  from which the membership-motion graft fixes a motion's roll.
- `sitting(db, person, from, until)` (`./api`): the circles a person
  sits in on any day of a span, the assembly first, which a form offers
  as the circles a record may be worked for, and `offering` (`./models`)
  puts the one the record's own circle names first where they sit in
  it, as the week of time offers a project's circle.

The app role and the guards role may select, the app role what [the
structure's reading](#who-reads-the-structure) lets it; the app role may insert a
member or a tenure, through `seat.add`, and end one, through
`seat.remove`, and a role's membership of a circle, through
`role.seat`, and end it, through `role.unseat`. Lanterne's members and
tenures are seeded, the lead role's seat in coordination among them.

## Authority

Authority flows down the mandates, from the assembly. Every mandate has
an issuer, the circle whose motion adopted its policy, and every
mandate the assembly did not issue has a parent: a mandate its issuer
holds as a whole, a collective mandate, for the same power. So the
mandates form a provenance tree by `parent`, and what is under a circle
or a role is what it issued, never where it sits. The assembly holds
every power inherently, the co-op's members being its sovereign: a
mandate it issues is a root, with no parent, and the founding motion
issues the first of them from the legal form. Any other circle issues
a mandate only under one it holds: coordination grants Web's lead
`approve-expense` under the `approve-expense` the assembly granted
coordination, and may grant none while it holds none.

To issue, the assembly needs no mandate above it; to use a power by
motion, it needs a collective mandate of its own, as every circle does,
so ending its `suspend-member` stops it suspending members. Through its
`adopt-policy` it grants itself again any power it ended, so that one
it always keeps: `circle.sovereignty` says why the assembly would hold
no collective `adopt-policy` mandate in force on the verdict date, with
no `until` and never revoked, once a write or a motion is carried out,
one whose `from` is a later day keeping nothing until then, so a
replacement leaves no day without one; and `circle.sovereign`, on
every write that adopts, replaces or ends a policy, refuses one that
ends or replaces a policy granting such a mandate (`circle.sovereign_by`)
and leaves it without one. A motion of the assembly ending its last such mandate,
or replacing it with one that lapses or that applies only from a later
day, is refused at its proposal and again as it is written, the
refusal saying that the assembly would lose the power to adopt policies
and that adopting another in its place, in the same motion, keeps it.

A mandate is narrower than its parent: it grants the same power; its
cap is no wider, so where the parent is capped it limits a write by at
most the parent's limit or budgets the same period by at most its
budget; its scope is no wider, any under a parent on the whole co-op,
and under one on a circle, or on `own`, the same; its term is no
longer, from no earlier and until no later than the parent's; and its
procedure, where it states one, is no looser
than what the parent's chain asks, which the motion feat checks, since
core knows procedures by name alone. The parent is found as the policy is adopted,
`circle.parent_of(policy)`: the first of the issuer's mandates for the
power, standing on the day the policy applies, that the new one is
narrower than, or else the first it holds for the power, so a refusal
says how the new one is wider. A grant from a circle that holds no
mandate for its power, or one wider than all it holds, is refused. A role every
working circle has (`*`) is the assembly's to grant, so its mandates
are roots; a right, no mandate, is in none of it. A power exercised "by
motion" is a collective mandate, held by a circle and used only through
a motion of that circle.

## Revocation

Revoking a mandate revokes everything issued under it. Ending a mandate
policy, or replacing it, revokes its mandate and every mandate below it
in the provenance tree, on the same day, in the write that ends or
replaces it: `circle.revoke(mandate, day)` walks the tree down from it
(`circle.under`) and revokes each that still stands then, returning
them, the mandate first, so the write submits each it revoked. When the
assembly ends coordination's `approve-expense`, Web's lead's, issued
under it, is revoked the same day, and a Web expense its lead approves
after is refused. A mandate already revoked, or expired, by that day is left
as it is; one to be revoked later has its day brought forward, the one
change a revoked mandate allows. The policies of the mandates revoked
below stay in the register, their mandates granting nothing, and a
motion of their own circle may still end them.

A handover revokes nothing: the role holds the mandate, and a change of
tenure changes who holds the role, never what it holds.

## Lifecycle

| Thing | States |
|---|---|
| circle | created, by a motion, with the default bundle in force that day → dissolved |
| mandate | granted, as its policy is adopted → revoked, as its policy ends or is replaced, or as a mandate it is issued under is revoked, or expired at `until` |
| right | given, as its policy is adopted → revoked, as its policy ends, or expired at `until` |
| tenure | held → ended; a handover ends one and begins the next, and ends no mandate |
| member of a circle | a person or a role, from → until |

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/circle/create` | ordered | a new circle, by motion |
| `POST /api/circle/message` | confluent | the circle's channel |
| `POST /api/circle/seat.add` | ordered | who holds which role |
| `POST /api/circle/seat.remove` | ordered | who holds which role |
| `POST /api/circle/role.seat` | ordered | where a role's holders sit |
| `POST /api/circle/role.unseat` | ordered | where a role's holders sit |

A mandate has no action of its own: it is granted and revoked by the
motion feat's `motion:policy:adopt` and `motion:policy:end`, both
ordered, which the motion feat extends with core's `granting` and
`revoking`. Creating a circle places it nowhere: circles never nest.

- A mandate's grant and revocation change what a role may do. A
  revocation takes effect at its receipt: a write received after it is
  refused; a share already granted runs out on its own.
- **create** makes a circle, by the motion it cites: its id, name and
  purpose, deciding by consent until a motion changes its procedure,
  beside every other and inside none. It commits the circle and the
  default bundle in force on the verdict date (`circle.bundle`), so its
  members read its records and its roles act on them from that day.
  Ordered, since the same motion's later actions seat people in it.
- **message** posts to the channel. Messages merge in any order; it has
  no handler yet.
- **seat.add** and **seat.remove** begin and end a tenure, where they
  name a role, or a person's membership of a circle, where they name
  none, and so change who may use the powers a mandate grants. A
  handover is a motion ending one tenure and beginning the next, in that
  order, since the role's cap counts both on the verdict date; every
  mandate stays on the role, and every seat the role brings, as the lead
  role's in coordination, moves to the new holder. Spending writes read
  seats through `membership.may`, so they are ordered.
- **role.seat** makes a role a member of another circle, from the
  verdict date, so whoever holds the role sits there, with no role, for
  the days their tenure runs: the holder of a later tenure sits there
  with no seat of their own, and one whose tenure ended no longer does.
  **role.unseat** ends that membership on the verdict date and leaves
  every tenure of the role standing. Both change who sits where, and so
  who reads and votes there, so they are ordered.

## Powers

| Action | Power or check | Lanterne |
|---|---|---|
| a mandate policy adopted or ended | `adopt-policy` or `end-policy`, collective mandates: the cited motion adopts or ends it, and carried | the assembly or coordination, by motion |
| create | `create-circle`, a collective mandate: the motion it cites creates this circle | the assembly, by motion |
| message | `discuss`, held in the circle | the circle's participants |
| seat.add | `seat-member`, a collective mandate: the motion it cites gives this seat | the assembly, admitting a member; coordination, seating one in a working circle, and the assembly in coordination or itself |
| seat.remove | `seat-member`, a collective mandate: the motion it cites ends this seat | as seat.add |
| role.seat | `seat-member`, a collective mandate: the motion it cites seats this role in this circle | as seat.add: coordination, a role in a working circle, and the assembly, a role in coordination |
| role.unseat | `seat-member`, a collective mandate: the motion it cites ends this role's seat | as seat.add |

A circle is created by the motion it cites, a `circle` action of a
motion of a circle holding `create-circle`: the guard that judges it is
membership-motion's, which joins the motion, that the cited motion
creates this circle with the name and purpose it gives, and that the
entry names the bundle in force that day. The same motion may seat
people in it by its later actions, whose proposal reads the circle an
earlier action creates as one there is.

A seat is given and ended by the motion it cites: the guards that judge
it are membership-motion's, which joins the motion, that the cited
motion carried and gives or ends this seat, which in the assembly is an
active member's and elsewhere any person's whom membership has not
suspended or let go. An admission gives one, the new member's in the
motion's circle in its `member` role; a `seat` or `unseat` action
names any other.

A role is seated in a circle, and unseated, by the motion it cites, a
`seat-role` or `unseat-role` action naming the circle and the role,
which membership-motion's guards judge at the proposal and again as it
is written: the circle and the role are ones there are; the role is
not the circle's own, whose holders sit there by their tenures, so a
role of one circle is seated only in another, and a `*` role, held in
every working circle, in any; a role sits in a circle once, so a
second seat while one runs is refused; and ending one names a seat the
role holds there. Each refusal names the role and the circle, and what
would fix it. Circles and roles have no end of their own, so none is
refused for having ended.

A mandate's policy is carried by a motion: it cites it, which the
motion feat checks asks this, was put to a circle
that may decide it and that holds the collective mandate for the
power, and `membership-motion` that it carried, and which
`membership-motion` carries out when it passes. A message needs
the participant's `discuss`, which `membership.may` finds on a
seat and `membership.sits`, the membership feat's guard, on a seat in
the message's circle that counts.

## Guards

- `circle.grants`, which the motion feat attaches to `motion:policy:adopt`:
  a mandate policy the write adopted has its mandate, to the grantee,
  for the power, capped, scoped and on the days its values and its
  policy say, and a right policy its right; the mandate or the right of the policy
  it replaces is revoked by the day it applies, and with that mandate
  every mandate issued under it (`circle.outlives`, the first still
  standing, as a reason); and no policy of another kind has one; a
  disclosure rule has its values in `circle.disclosure`, and those of the
  rule it replaces are revoked the day it applies.
- `circle.revokes`, which the motion feat attaches to `motion:policy:end`:
  the mandate, the right or the disclosure values of a policy the write
  ended are revoked by the verdict date, and with the mandate every
  mandate issued under it, down its provenance tree (`circle.outlives`).
- `circle.narrows`, which the motion feat attaches to both: after the
  write, every mandate standing on the verdict date, in force or yet to
  be, is a root the assembly issued, or is issued under a parent its
  issuer holds, standing with it, and is narrower than it
  (`circle.overreach(day)`, the first that is not, as a reason, and
  `circle.wider`, how a mandate's values are wider than a parent's). A
  grant from a circle holding no mandate for its power, or wider than
  every one it holds, is refused; so is a write that leaves a mandate
  standing under one that no longer stands, which `circle.revoke`
  revokes with it ([revocation](#revocation)).

## Handlers

- `granting(tx, policy)` and `revoking(tx, policy)`, the state of a write
  the motion feat extends: copy a mandate policy's values into `circle.mandate`,
  with its issuer, the policy's circle, and its parent,
  a right policy's into `circle.right`, or a disclosure rule's into
  `circle.disclosure`, and revoke those of an ended
  one and of the one a new policy replaces, by `circle.mandate_from` and
  `circle.mandate_ended`, the mandate with every mandate issued under it
  (`circle.revoke`); each returns the mandate, or none for a right or a
  policy of another kind, and every mandate it revoked, the one ended or
  replaced first, which the motion feat submits.
- `create` (ordered): inserts the circle, by the id, name and purpose
  the cited motion gives, and commits them with the motion and the
  bundle in force on the verdict date. The membership-motion graft
  carries it out as a passing motion's `circle` action.
- `add` (ordered), and `seating`, its state alone, which a passing
  close runs in its own transaction for each member it admits: inserts
  a tenure of the role it names, or a membership of the circle where it
  names none, from the verdict date, and commits its id, circle, member,
  role and the motion it cites.
- `remove` (ordered): ends the person's tenure of the role in the
  circle, or their membership of it where it names no role, on the
  verdict date, and commits the same. The membership-motion graft
  carries out the seats a passing motion gives and ends, as its
  reaction to the close.
- `seatRole` and `unseatRole` (ordered): insert a membership of the
  circle whose member is the role, from the verdict date, and end it on
  the verdict date, touching no tenure; each commits its id, circle,
  role and the motion it cites. The membership-motion graft carries
  them out as a passing motion's `seat-role` and `unseat-role` actions.

## Folds

Each action that writes core's circles says how its entry applies to
the state before it (`sql/011-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)), at version 1:

- `circle:circle:create` (`circle.fold_create`) inserts the circle by
  the id, name and purpose its entry carries, and refuses where the
  default bundle in force on the entry's day is not the one it names.
- `circle:seat:add` (`circle.fold_seat_add`) inserts the seat by the id
  its entry carries, from the entry's day: a tenure of the role it
  names, or a membership of the circle where it names none, so a seat
  id a write rolled back took is never taken again.
- `circle:seat:remove` (`circle.fold_seat_remove`) ends the seat its
  entry names on the entry's day; one naming no seat, `0`, ends none.
- `circle:role:seat` (`circle.fold_role_seat`) inserts the membership
  of the circle whose member is the role, by the seat id, circle and
  role its entry carries, from the entry's day.
- `circle:role:unseat` (`circle.fold_role_unseat`) ends the membership
  its entry names on the entry's day; one naming no seat, `0`, ends
  none.
- `circle:circle:message` (`circle.fold_message`) has no handler, so no
  entry of it is logged, and its fold refuses one rather than change
  nothing.
- `motion:policy:adopt` and `motion:policy:end` (`circle.fold_granting`,
  `circle.fold_revoking`), after the motion feat's own folds, run
  `circle.mandate_from` or `circle.mandate_ended` on the policy register
  as it then stands, the mandate's id pinned to the entry's, and refuse
  a mandate or a revocation other than the entry's. A right's and a
  disclosure's ids are not in the entry, so they come from their
  sequences.

The roles and the circles a scope begins with are the founding's, whose
entry does not yet carry them, so a fold of Lanterne's log holds none of
them and the compare names every circle table as differing.

## Invariants

Core's circles own:

- circles never nest: no circle has a parent, and one circle only is
  the assembly;
- a mandate is a root the assembly issued, or is issued under a parent
  its issuer holds and is narrower than it (`circle.narrows`);
- a mandate's grantee is one circle or one role, by one key, never a
  person, and a right has none;
- a mandate caps its power with a `limit` per write or a `budget` over a
  period, never both;
- a mandate is its policy's values, on its policy's days; its term has
  `from` before `until`; a revoked mandate stays revoked, from its day
  or an earlier one;
- no mandate stands under one revoked: revoking a mandate revokes every
  mandate issued under it, the same day;
- a tenure is of a role in its own circle, or of a `*` role in a
  working circle, and no more hold a role in a circle at once than its
  cap.

What it does not own: whether a seat counts on a day and so who may use
a power (the membership feat), and who may vote on a circle's motions: the roll, those seated in the circle
when a motion is proposed as its procedure says, and the count of
those on it whose seat counts, are the `membership-motion`
graft's.

## What it does not know

Core's circles know no members, motions or accounts; it reads the policy
register in org's core, never a policy's wording. Templates of roles for
common co-op shapes, colleges of a multi-stakeholder co-op and mandates
requested by another scope (rung 5) build on these entities later.

## Shell

The `circles` collection, the assembly first and the others by name, as
a gallery of cards by default, and its structure drawn as the mandates
link the circles, never as a tree: each circle with the circles that
issued what it and its roles hold, and those it issued to. A circle's
page lists its roles,
those every working circle has among them, and the mandates granted to
them, each its policy's sentence as it reads (`sentences` in
`@cella/org-policy`), with their limits, budgets, scopes and days, and
who issued each. Who sits in it is the membership feat's, which names
people. Proposing to grant a mandate to one of its roles or revoke one
is the motion feat's, a seat in it membership-motion's: the page's writes propose, and the
close of a passing motion carries them out.

## Who builds on it

Every feat and graft reads core's circles; those that extend them:

- the membership feat: whether a seat counts on a day, and so who may
  use a power, `may`, `over` and `entitled`, the authority every read
  asks; a circle's seats on its page, and a person's on theirs.
- the motion feat: mandates as the policies its circles adopt and end,
  and whom a circle's motion decides about.
- the meeting feat: a meeting's circle, and how a circle meets.
- `membership-motion`: the seats a motion gives and ends, and its roll.
- `membership-project`, `membership-timesheet`,
  `meeting-membership`: a power covers what its mandate's scope
  does, for projects, timesheets and meetings; the months waiting on a
  member's approval, in their inbox.


## Lanterne

| Circle | Purpose |
|---|---|
| Assemblée générale, the assembly | every member, one vote: statutes, admissions, accounts and surplus |
| Coordination | weekly: pipeline, staffing and anything that crosses circles |
| Web, Brand, Marketing, Operations | the working circles |

No circle sits in another: coordination is the working circles' by the
mandates the assembly issued it, not by a place above them.

| Role | Power | Cap |
|---|---|---|
| Member (every member, in `ag`) | `edit-contact`, `edit-document`, `edit-task`, `invite-member` | — |
| Gérante (Camille, in `ag`, 2024–2028) | `commit` | 20 000 € limit |
| Gérante | `approve-expense` | 2 000 € limit |
| Gérante | `set-budget` | 50 000 € limit |
| Gérante | `approve-bill` | 5 000 € limit |
| Gérante | `approve-payroll`, `manage-project`, `approve-time` | — |
| Treasurer (Julien, in `ag`) | `approve-time` | — |
| Finance (Julien, in `operations`) | `pay-supplier`, `reimburse-expense` | 3 000 € limit |
| Finance | `record-entry`, `issue-invoice`, `record-receipt`, `record-bill`, `close-period`, `prepare-payroll`, `pay-payroll` | — |
| Circle lead (`*`) | `approve-expense` | 1 000 € budget, a month |
| Circle lead | `send-quote` | 15 000 € limit |
| Circle lead | `set-budget` | 15 000 € limit |
| Circle lead | `manage-project`, `approve-time` | its own circle |
| Circle lead | `schedule-meeting`, `keep-minutes` | its own circle |
| Gérante | `schedule-meeting`, `erase-personal-data` | — |
| Secretary (`*`: Julien in the assembly, Malik in coordination) | `keep-minutes` | its own circle |

A cap of "its own circle" is the mandate's scope, `{scope: own}`: a
lead runs, approves the time of and keeps the minutes of their own
circle alone. Every other mandate marks none and covers the whole
co-op, so the gérante's `manage-project` and the treasurer's
`approve-time` cover every circle's, and finance pays a Web supplier
as it pays any.
| Participant (every seat, in its circle) | `propose`, `discuss` | — |
| Participant | `read` | its own circle; and the assembly's |
| Member | `read`, open books | — |

The gérante, the treasurer, finance, a circle's lead and a circle's
secretary are each held by one person at a time (`holders` 1); the
member role is uncapped. Each holds their role by a tenure, Camille
hers as gérante from 20 June 2024 until 20 June 2028; the lead role is
a member of coordination, so each working circle's lead sits there by
their tenure, and Camille sits there as a member.

| Circle, by motion | Power |
|---|---|
| Assemblée générale | `admit-member`, `suspend-member`, `exclude-member`, `adopt-policy`, `end-policy`, `approve-distribution`, `adopt-document`, `seat-member`, `create-circle` |
| Coordination | `adopt-policy`, `end-policy`, `adopt-document`, `seat-member` |

| Right, given by the form | Power |
|---|---|
| Every person | `keep-profile`, `keep-devices`, `upload-file`, `accept-invitation`, `file-record`, `mark-read`, `record-import`, `withdraw-membership`, `erase-own-data` |
| Every member | `draw-account`, `spread-capital`, `mark-attendance`, `save-report` |
| Every employee | `log-time`, `claim-expense`, `apply-membership` |

Each is a policy of the assembly, a mandate or a right, adopted with
the statutes by the founding motion, m-2021-001, on 1 March 2021, and in force since;
each mandate among them is a root, the assembly its issuer. So
coordination, which holds no mandate for a role's power, grants a
working circle's role none until the assembly grants it one to issue
under.
Lanterne's default bundle is what the founding motion grants the
participant, lead and secretary roles, so a circle the assembly creates
has its members read its records, its lead run its projects, approve
its time and schedule its meetings, and its secretary keep its minutes,
from the day it is created. Lanterne keeps open books: the founding
motion grants the member role `read` on every circle's records, so a
member of Brand reads Web's expenses, while Inès, employed and seated
in Web alone, reads Web's and the assembly's, and not Marketing's. Its
disclosure rule is the founding motion's last, with the defaults above,
so a member reads a month's payroll or a project's time only where at
least five people are in it and no one or two make most of it, unless
a power of theirs reads every row of it.
So the working circles carry no action by motion: a motion of Web
decides by its text alone, and one carrying an action is refused at its
proposal until a circle holding one grants Web a collective mandate for
it.

## Analytics

Core's circles publish no [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts): a shared view is read whole by every reader of a report, and the structure is its members' alone ([who reads it](#who-reads-the-structure)), so a view that showed the circles, roles, mandates, rights, seats or open books' values to the analytics shell would show them to a person who is no member. A report reads open books' values in force through the port's reader, `circle.disclosed` ([the port](../analytics/index.md#the-reader)), not through a view.
