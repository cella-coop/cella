+++
title = "circle-person"
updated = 2026-11-11
+++

Core's graft joining the circles to the people, two of org's core feats
that know nothing of each other
([core grafts](../../../../../_corpus/doc/architecture.md#core-grafts)).
Every person and every device names its owning circle, `circle`, as
every record does, and is read by it ([owning
circle](../../../../../_corpus/doc/architecture.md#sql)); the people
([person](../../person/index.md)), knowing no circle, name it as text,
and this graft binds it to the circles ([circle](../../circle/index.md))
and puts the people's tables under the circles' row-level policies.

## Schema

`circle_person` (`sql/`), its own schema, named for it as every graft's
is, holds nothing yet; what it does is on the core feats it joins:

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

It binds the column and secures the tables, and nothing else: `cella
check feats` lets a core graft joining the circles alter a table of a
core feat it joins only to put it under row-level policies or to bind
its `circle` to its owning circle (`tools/_tests/core.test.mjs`).
