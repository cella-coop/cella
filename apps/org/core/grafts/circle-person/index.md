+++
title = "circle-person"
updated = 2026-11-20
+++

Core's graft joining the circles to the people, two of org's core feats
that know nothing of each other
([core grafts](../../../../../_corpus/doc/architecture.md#core-grafts)).
Every person and every device names its owning circle, `circle`, as
every record does, and is read by it ([owning
circle](../../../../../_corpus/doc/architecture.md#sql)); the people
([person](../../person/index.md)), knowing no circle, name it as text,
and this graft binds it to the circles ([circle](../../circle/index.md))
and puts the people's tables under the circles' row-level policies. And
it holds who may act ([who may act](#who-may-act)), since that reads
the seats and the people both.

## Schema

`circle_person` (`sql/`), its own schema, named for it as every graft's
is:

- `001-circle-person.sql`: `person.person.circle` and
  `person.device.circle` each a foreign key into `circle.circle`, and the
  assembly's by default (`circle.assembly()`), so a person entered or a
  device enrolled with no circle named is the assembly's; and the
  people's tables under row-level security, enabled and forced, with the
  policies the circles put a slice's table under as it is made
  (`circle.scoped`, [reading](../../circle/index.md#reading)): a person
  and a device under `circle`, read by their owning circle, and
  `person.rights`, a registry, under `registry`, which every reader
  reads. The circles' event trigger passes the people's schema by, as it
  does the register's (`circle.cored`), and `cella migrate` fails a run
  that leaves one of its tables outside them (`circle.unsecured`).
- `002-authority.sql`: who may act, below; `circle_person.standing`, a
  registry, the one table it makes, under `registry` as the circles'
  event trigger puts it.

It binds the column and secures the tables, and alters nothing else of
the feats it joins: `cella check feats` lets a core graft joining the
circles alter a table of a core feat it joins only to put it under
row-level policies or to bind its `circle` to its owning circle
(`tools/_tests/core.test.mjs`).

## Who may act

Whether a seat counts on a day, and so who may use a power: the seats
and the mandates are the circles'
([circle](../../circle/index.md#seats)), the people and the rights they
hold as such the people's ([person](../../person/index.md)), and what
reads both is here, in core, so no feat outside it holds the authority
and removing one changes no other slice's authorization.

- `circle_person.register_standing(fn, owner)`: a kind of person, a feat
  of the app, registers what bars a seat of its people in
  `circle_person.standing`: `fn`, `(person, circle, day) → text`, why the
  seat does not count on the day, naming no person, or null where it
  bars none. Membership registers `membership.standing`: the assembly's
  seats are its active members', and no seat counts of someone it has
  suspended or let go ([membership](../../../feats/membership/index.md#seats)).
- `circle_person.unseated(person, circle, day)`: why a seat in the
  circle does not count on the day, or null where it counts: the person
  is no one the coop knows (`person.known`), or the first reason a
  registered standing gives. A scope where no kind of person registers
  one bars no seat of a person it knows.
- `circle_person.counts(person, circle, day)`: the seat counts, no
  reason barring it. `circle_person.sits_in(person, circle, day)`: they
  hold a seat in the circle on the day, and it counts; the guards that
  know the circle an action concerns ask it.
- `circle_person.may(actor, power, cents, about, day)`: the actor holds,
  on the day, a seat that counts, whose role, or the participant role
  every seat holds, has a mandate in force for the power, not revoked
  by the day, whose scope covers `about`, the owning circle of the
  record a write concerns (`circle.covers`, [core's
  scope](../../circle/index.md#mandates)), within its `limit` when the
  write carries an amount. A mandate marking no scope covers every
  circle's records; one on a circle (`{scope: web}`) that circle's
  alone; one on `own` those of the circle of the seat it is held by, so
  a lead's covers their own circle and no other. Circles never nest, so
  a power held in one circle reaches no other by where it sits; the
  record's circle grants nothing by itself, and a seat in it nothing
  without a mandate. `about` null asks of no record and any mandate for
  the power answers it, as a key's reach and the log's disclosure ask.
  A `budget` is not checked: it needs the spend over its period
  tracked.
- `circle_person.holds(person, day)`: the mandates in force the person
  holds on the day by their seats, each with the circle of the seat it
  is held by: on every seat that counts and has begun and not ended, its
  role's and the participant role's every seat holds, so a seat with no
  role still holds the participant's, and each of those once for every
  circle the person sits in. It is the one place the seats and mandates
  are joined: `may` and `covered` ask it, and a person's page lists it,
  so nothing lists a mandate `may` would not grant, or leaves out one it
  would.
- `circle_person.covered(actor, power, day)`: the owning circles whose
  records the actor's mandates for the power cover on the day, by the
  same seats and mandates as `may`: every circle for one marking no
  scope, the seat's circle for `own`, the circle it names for any
  other. With `may` it is the authority every read asks
  (`cella.authority`, which this graft registers): on the verdict date
  it says in which circles the reader holds `read`, or a power a feat
  names as reading its rows in `cella.reading`
  ([reading](../../circle/index.md#reading)), and it finds no right.
- `circle_person.rights(person, day)`: the rights in force in
  `circle.right` the person holds on the day, where core's person says
  they are one of the people each names (`person.holds`). It is the one
  place the rights and the people are joined, as `holds` is for the
  seats: `entitled` asks it, and a person's page lists it. It runs as
  its owner, and to the app's reader it answers for themselves, or for
  anyone where they are a member (`circle.inside()`), and otherwise
  nothing: a person who is not a member reads the rights they hold,
  each with its power and limit, and no other row of `circle.right`.
- `circle_person.entitled(actor, power, cents, day)`: the actor holds
  the power by a right, with no seat: a right `rights` gives them on the
  day, within its `limit`. A right lets each act on what is their own,
  which the feat's guard checks, so it opens no one else's rows to read
  ([rights](../../circle/index.md#rights)). A right reaches the whole
  coop.
- `circle_person.empowered`, on every action in `cella.power`, the one
  guard that reads a permission's scope: the actor may use the action's
  power on the verdict date over the record the write concerns, by a
  seat's mandate covering its circle (`may`) or by a right
  (`entitled`), for the amount the payload names in the action's
  `amount` field. The payload names the record's owning circle,
  `circle`, as its handler reads it from the record or writes it there,
  and one naming none concerns the root's, the assembly's. Refused, it
  names the mandate missing or exceeded and what would fix it, read by
  `circle_person.why_not(actor, power, cents, about, day)`, with the
  values it read: where the actor holds the power by a mandate on a seat
  that does not count, that mandate and why the seat does not
  (`unseated`); where by a mandate whose limit the amount exceeds, that
  mandate, its role and circle, its limit and the amount, and that a
  motion of its issuer raising the limit, or someone holding a mandate
  up to the amount, would allow it; where by a mandate whose scope does
  not cover the record's circle, that mandate, what it covers and the
  record's circle; where they held one that is revoked or expired by
  the day, that one and since when; where they hold none, the power,
  and the roles that hold it in the record's circle, with the circle
  whose motion grants it. It names roles, circles and mandates, never a
  person. Each feat and core registers the power its actions need in
  `cella.power`; this graft attaches its guard to every op listed, then
  and later, as the motion feat attaches its own to `motion.cites`. A
  write with no power, or whose power is in `motion.cites`, a
  collective mandate's, gets no such guard. No slice checks a scope
  again: a project's, a month's and a meeting's circle are read here,
  from the payload their writes name. What it answers once the payload
  names its amount is `circle_person.refused(actor, power, cents, about,
  day)`: null where `may` or `entitled` grants it, else `why_not`'s
  reason.
- `circle_person.judged(op, about)`: the same judgement asked before the
  write, as a guard refuses as early as its terms are known ([early and
  actionable](../../../../../_corpus/doc/architecture.md#early-and-actionable)):
  what `empowered` would answer the reader (`cella.reader()`) for the
  op over a record of the circle `about` on the verdict date, by
  `refused`, with no amount, since what an amount exceeds is judged once
  it is given; null where it would let it, or where no such guard
  attaches to the op. `about` null asks of no record, so a record naming
  no circle is judged by whether the reader holds the power at all. It
  runs as its owner, reading the seats, the mandates and what bars a
  seat whole as the guard does as the guards role, and judges the reader
  alone: a scalar, it says only what making the write would say to
  them. A record's page asks it of every write its collection offers in
  one read (`Judge`, which membership serves), and draws a write that is
  its one button and refused unavailable, with the reason as its tooltip
  ([the UI core](../../ui/index.md)).

Its tests are the membership feat's (`counts.test.ts`, `may.test.ts`,
`holds.test.ts`, `rights.test.ts`, `why-not.test.ts`), which run it with
membership's standing registered, and the e2e scenarios on Lanterne.
