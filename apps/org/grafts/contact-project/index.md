+++
title = "contact-project"
updated = 2026-11-06
+++

Whom a project is for. A project without a link is the co-op's own, not
invalid. Declared by `project`.

## Schema

`contact_project` (`sql/`): `contact_project.commission`, a project and the
contact it is for, by id, with no foreign key into either feat. A trigger
refuses a project or a contact that does not exist (SQLSTATE `09000`). The
app role may select, insert and update; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `contact-project:project:link` | confluent | `manage-project` | the last writer wins; a project is for one contact |

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Invariants

- a commission's project and contact exist.

## Shell

Adds to each project the contact's name, a card field of the projects'
gallery, and to a project's page the contact with the form that links it;
to a contact's page, the projects it commissioned.

## Lanterne

Each of the eight projects is for the contact its title names: the Halles
shop for Les Halles Paysannes, the town website for Ville de Clairval,
and so on.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `contact_project.commissions` to the analytics shell: which contact commissioned each project. It is scoped by `circle`, the circle that owns each row.
