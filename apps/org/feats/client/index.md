+++
title = "Client"
updated = 2026-10-24
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
at Lanterne and, at rung 3, its e-invoicing route. A client's email and
phone are personal data when the client is a person, and stay out of the
log.

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

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/client/add` | confluent | the last writer wins |
| `POST /api/client/update` | confluent | the last writer wins |
| `POST /api/client/archive` | confluent | the last writer wins |

Each field is its own register, so two members updating different fields
of one client both keep their change, and two updating the same field
resolve to the later receipt. Nothing a client write changes is read by an
ordered write's rule, so none of them waits.

## Powers

| Write | Power | Lanterne |
|---|---|---|
| add, update | `edit-client` | every member, through the `member` role's mandate |
| archive | `edit-client` | every member, through the `member` role's mandate |

`002-powers.sql` registers the power in `cella.power`, and the
`circle-member` graft checks it as any other: a power every member holds is
granted through a mandate on a role every member is seated in, never
allowed by omission, so a non-member's or a suspended member's device is
refused.

## Invariants

- a client's `parent` is a company, never itself, never a person;
- a person's personal data is committed to the log, never written into it.

What it does not own: which invoices bill a client (`client-invoice`),
which projects serve it (a later `client-project` graft).

## What it does not know

Client knows no invoices, projects or payments. What a client owes is read
through the `client-invoice` graft. Duplicates, two members adding the
same company, are merged by hand.

## Schema

`client` (`core/sql/`): `client.client`, with the fields above, the
address as JSON. A trigger refuses a parent that is not a company (SQLSTATE
`09000`), and a check refuses a client its own parent. The app role may
select, insert and update; the rules role, `cella_rules`, may select.

## Handlers

`add`, `update` and `archive` (confluent) set the given fields from a
fixed list of columns. At rung 1 the server applies writes in receipt
order, so the last write to a field wins it, field by field. The log
commits to the client's id and the names of the fields a write changed,
never their values. Erasure is not built.

## Lanterne

Eight clients, mostly co-ops, associations and small local firms:

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
