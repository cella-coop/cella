+++
title = "client-project"
updated = 2026-11-01
+++

Whom a project is for. A project without a link is the co-op's own, not
invalid. Declared by `project`.

## Schema

`client_project` (`sql/`): `client_project.commission`, a project and the
client it is for, by id, with no foreign key into either feat. A trigger
refuses a project or a client that does not exist (SQLSTATE `09000`). The
app role may select, insert and update; the guards role may select.

## Writes

| Write | Label | Power | Why |
|---|---|---|---|
| `client-project:project:link` | confluent | `manage-project` | the last writer wins; a project is for one client |

`002-powers.sql` registers the power in `cella.power`, and the
`circle-membership` graft checks it.

## Invariants

- a commission's project and client exist.

## Shell

Adds to each project the client's name, a card field of the projects'
gallery, and to a project's page the client with the form that links it;
to a client's page, the projects it commissioned.

## Lanterne

Each of the eight projects is for the client its title names: the Halles
shop for Les Halles Paysannes, the town website for Ville de Clairval,
and so on.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `client_project.commissions` to the analytics shell: which client commissioned each project.
