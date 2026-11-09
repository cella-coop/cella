+++
title = "contact-project"
updated = 2026-11-09
+++

Whom a project is for: a client, a contact holding the client role
([contact](../../feats/contact/index.md#the-client-role)). A project
without a link is the co-op's own, not invalid. Declared by `project`.

## Schema

`contact_project` (`sql/`): `contact_project.commission`, a project and the
contact it is for, by id, with no foreign key into either feat. A trigger
refuses a project or a contact that does not exist, and a contact that
is no client, naming it and saying to set its client role (SQLSTATE
`09000`). The
app role may select, insert and update; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `contact-project:project:link` | confluent | `manage-project` | the last writer wins; a project is for one client |

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Invariants

- a commission's project and contact exist, and the contact is a client
  when the link is made.

## Folds

A link folds by `contact_project.fold_link` (`sql/003-folds.sql`,
[folds](../../../../_corpus/doc/architecture.md#folds)): the project its entry names, for
the contact it names, linking again moving it; the graft's trigger
judges both sides again, as it did.

## Shell

Adds to each project the contact's name, a card field of the projects'
gallery, and to a project's page the client with the form that links
it, whose picker offers the clients not archived and no other contact;
to a contact's page, in a Projects tab, the projects it commissioned.

## Lanterne

Each of the eight client projects is for the contact its title names:
the Halles shop for Les Halles Paysannes, the town website for Ville de
Clairval, and so on. The three the circles run for themselves, the
statutes, the 2027 pipeline and the books' move, are for no contact.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `contact_project.commissions` to the analytics shell: which contact commissioned each project. It is scoped by `circle`, the circle that owns each row.
