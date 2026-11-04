+++
title = "Client"
updated = 2026-11-04
+++

The organisations and people the co-op works for: its CRM. Companies and
people share one collection, so a contact at a company is a client whose
`parent` is that company. A client is a record the co-op keeps for itself;
an invoice copies the name and address it bills when it is issued, so
editing a client never changes an issued invoice.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| client | `id`, `kind`, `name`, `form?`, `email?`, `phone?`, `address?`, `parent?`, `tags[]`, `note`, `status` | `kind` is `company` or `person` |
| address | `street`, `city`, `region?`, `postal_code`, `country` | `country` is ISO 3166-1 alpha-2 |

`parent` names another client in this collection. `form` is the client's
legal form (`SCIC SA`, `association`, `commune`), which decides its rate
at Lanterne and, at rung 3, its e-invoicing route. A client's name,
email, phone, address and note are registered as personal data, of class
`contact`, by its id (`003-personal.sql`): every write commits to them
in the log and keeps them in the vault, and erasing a person redacts
them.

## Lifecycle

| State | Meaning |
|---|---|
| lead | a prospect, not yet billed |
| active | billed in the last year, or under contract |
| inactive | no work for a year |
| archived | hidden from lists, kept for the books |

A client is never deleted while an invoice names it; archiving hides it.
A person's contact details are erased on request, which leaves the
company and the invoices intact.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/client/add` | confluent | the last writer wins |
| `POST /api/client/update` | confluent | the last writer wins |
| `POST /api/client/archive` | confluent | the last writer wins |
| `POST /api/client/erase` | ordered | erasure wins over every update, whichever arrives first |

Each field is its own register, so two members updating different fields
of one client both keep their change, and two updating the same field
resolve to the later receipt. Nothing a client write changes is read by an
ordered write's guard, so none of them waits.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| add, update | `edit-client` | every member, through the `member` role's mandate |
| archive | `edit-client` | every member, through the `member` role's mandate |
| erase | `erase-personal-data` | the gérante |

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it as any other: a power every member holds is
granted through a mandate on a role every member is seated in, never
allowed by omission, so a non-member's or a suspended member's device is
refused.

## Invariants

- a client's `parent` is a company, never itself, never a person;
- a person's personal data is committed to the log, never written into it.

What it does not own: which invoices bill a client (`client-invoice`),
which projects it commissioned (`client-project`).

## What it does not know

Client knows no invoices, projects or payments. What a client owes is read
through the `client-invoice` graft. Duplicates, two members adding the
same company, are merged by hand.

## Schema

`client` (`core/sql/`): `client.client`, with the fields above, the
address as JSON. A trigger refuses a parent that is not a company (SQLSTATE
`09000`), and a check refuses a client its own parent. The app role may
select, insert and update; the guards role, `cella_guards`, may select.

`client.erases`, on `client:client:erase`: the client is a person, and
the write erased their contact data and nothing else.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Handlers

`add`, `update` and `archive` (confluent) set the given fields from a
fixed list of columns. At rung 1 the server applies writes in receipt
order, so the last write to a field wins it, field by field. The log
keeps the client's id, the names of the fields a write changed and their
values, each personal one as a salted commitment. `erase` (ordered)
archives a person and submits the erasure of their `contact` class,
which the notary carries out as it settles: their values and salts
deleted from the vault, their fields redacted, any later value for them
refused.

## Shell

The `clients` collection, archived ones left out; a client's page edits
its note (`update`, the note field alone). What a client owes and the
invoices that bill it are `client-invoice`'s.

## Import

Clients from another tool's list, a CSV with the columns `name` and, if
it has them, `kind`, `form`, `email`, `phone`, `tags` and `note`: the
importer `clients`, each line a `client:client:add` as the importing
member. A client the co-op holds already, by its name, is refused; a
person among them is labelled by their line, never their name
([import](../import/index.md)).

## Lanterne

Eight clients, mostly co-ops, associations and small local firms, and
Margaux Roux, Les Halles' contact for the shop, a person:

| Client | Form | Work |
|---|---|---|
| Les Halles Paysannes | SCIC SA | brand refresh and an online shop in four milestones |
| Ville de Clairval | commune | the town website to RGAA accessibility, won by tender |
| Nuvola Énergie | SCIC SAS | a monthly marketing retainer |
| Compagnie Mauve Horizon | association | season posters and brochure; three months overdue |
| Vélo Solidaire | association | brand identity at the solidarity rate |
| Maison Ferrand | SARL | packaging for a range of six |
| Fondation Terres Vives | fondation | annual report and microsite |
| Atelier Ondine | SAS | an online shop, fixed price |

Associations pay the solidarity rate under the internal rules, so a
client's form matters to the rate card.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `client.clients` to the analytics shell: each client, by kind and status. A client may be a person, whose name erasure redacts; their contact details are not shared.
