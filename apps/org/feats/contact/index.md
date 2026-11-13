+++
title = "Contact"
updated = 2026-11-13
+++

The organisations and people the co-op deals with: its CRM. Companies
and people share one collection, so a person at a company is a contact
whose `parent` is that company. A contact is a record the co-op keeps
for itself; an invoice copies the name and address it bills when it is
issued, so editing a contact never changes an issued invoice.

A client is a contact the co-op bills: a role the contact holds, its
`client` field, and not a collection or a kind of its own. A company or
a person is a client while it holds the role, at one stage of the
role's lifecycle, and no client once the role is cleared.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| contact | `id`, `kind`, `person?`, `name?`, `form?`, `email?`, `phone?`, `address?`, `parent?`, `tags[]`, `note`, `client?`, `archived` | `kind` is `company` or `person`; a person contact names its core person by address, `person`, and a company its own `name`, `email` and `phone`; `client` is the client role's stage, none for a contact that is no client |
| address | `street`, `city`, `region?`, `postal_code`, `country` | `country` is ISO 3166-1 alpha-2 |

A contact of kind `person` is a core person
([person](../../core/person/index.md)), as a member or a worker is:
`contact.contact.person` is a foreign key into `person.person`, the
person's name, email and phone are core's, and the contact keeps what
the co-op knows of them as a CRM, their company, tags, note, address
and client role. Adding a person contact names a person the co-op
already knows, or makes one by address in the contact's own
transaction, as an invitation or a hire does; a client who is also a
member is one person, seen three ways. A company is no person and keeps
its own name, email and phone. Each human is one entry in People, a lead, a client's
accountant or a member alike; a person with no account keeps empty
devices, keyring and rights. Removing the contact feat leaves its
people in People, unlinked (corollary 3.3).

`parent` names another contact in this collection. `form` is the contact's
legal form (`SCIC SA`, `association`, `commune`), which decides its rate
at Lanterne and, at rung 3, its e-invoicing route. A company's name,
email and phone, and every contact's address and note, are registered as personal data, of class
`contact`, by its id (`003-personal.sql`): every write commits to them
in the log and keeps them in the vault, and erasing a person redacts
them.

## The client role

The lifecycle is the client role's: a contact that is no client has
none.

| Stage | Meaning |
|---|---|
| lead | a prospect, not yet billed |
| active | billed in the last year, or under contract |
| inactive | no work for a year |

The feat's own `update` sets the role, moves it between stages and
clears it, its `client` field one register like the others, so a
contact becomes a client, or stops being one, without leaving the
collection. Only a client is billed: `contact-invoice` links an invoice,
and `contact-project` a project, to a contact holding the role, and
refuses any other. Clearing the role leaves the links already made.

Every contact, client or not, is archived rather than deleted:
archiving hides it from lists and keeps it for the books, and a
contact is never deleted while an invoice names it. A person's contact
details are erased on request, the core person's with them, which archives the contact and leaves the
company and the invoices intact.

## Actions

| Action | Label | Why |
|---|---|---|
| `POST /api/contact/add` | confluent | the last writer wins |
| `POST /api/contact/update` | confluent | the last writer wins |
| `POST /api/contact/archive` | confluent | the last writer wins |
| `POST /api/contact/erase` | ordered | erasure wins over every update, whichever arrives first |

Each field is its own register, so two members updating different fields
of one contact both keep their change, and two updating the same field
resolve to the later receipt. Nothing a contact write changes is read by an
ordered write's guard, so none of them waits.

## Powers

| Action | Power | Lanterne |
|---|---|---|
| add, update | `edit-contact` | every member, through the `member` role's mandate |
| archive | `edit-contact` | every member, through the `member` role's mandate |
| erase | `erase-personal-data` | the manager |

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it as any other: a power every member holds is
granted through a mandate on a role every member is seated in, never
allowed by omission, so a non-member's or a suspended member's device is
refused.

## Invariants

- a contact's `parent` is a company, never itself, never a person;
- a contact's `client` is a stage of the client role, or none;
- a person contact names a core person and keeps no name, email or
  phone of its own; a company names none and keeps its own name;
- a person's personal data is committed to the log, never written into it.

What it does not own: which invoices bill a contact (`contact-invoice`),
which projects it commissioned (`contact-project`).

## What it does not know

Contact knows no invoices, projects or payments. What a contact owes is read
through the `contact-invoice` graft. Duplicates, two members adding the
same company, are merged by hand.

## Schema

`contact` (`core/sql/`): `contact.contact`, with the fields above, the
address as JSON and `client` the role's stage or NULL; `person` a
foreign key into `person.person`, checked at the end of the transaction,
since a fold applies the contact's own state before core person enters
them. A trigger refuses a parent that is not a company (SQLSTATE
`09000`), and another, `contact.person_is_core`, a person naming no
person or keeping a name, email or phone of their own, which are
core's, and a company naming a person or no name; a check refuses a
contact its own parent, and another a `client` that is no stage. The
view `contact.named` reads every contact with its name, email and phone,
a person's from core under core's row-level policy, a company's its
own: the collection and the grafts joining the contacts read it. The
app role may select, insert and update; the guards role,
`cella_guards`, may select.

`contact.erases`, on `contact:contact:erase`: the contact is a person, and
the write erased their contact data, and their core person's contact
details, and nothing else.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Folds

Each action folds by `core/sql/005-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
an add, the contact under the id its entry names, a person contact by
the address its `values` name, whom core person's fold enters after it
by the commitments its `entered` carries (`person.fold_contact`), an
update and an archive, its fields, each set to the value its entry
keeps of the fields it names and every other left as it was, a
personal one as its commitment, written `redacted`, as JSON in the
address. An erasure archives the person, and the erasures its entry
keeps, folded after it (`cella.fold_erasures`), drop the commitments to
their contact data and their core person's contact details and redact
them, as the notary did.

## Handlers

`add`, `update` and `archive` (confluent) set the given fields from a
fixed list of columns: `update` sets or clears the client role as any
other field, and `archive` sets `archived`. `add` of a person runs core
person's `entering` in its transaction, which brings in a person new to
the scope with the name, email and phone it gives, and its payload then
carries them as `entered`, each committed to as core's; a person the
scope knows keeps theirs, and the payload carries none. At rung 1 the
server applies writes in receipt order, so the last write to a field
wins it, field by field. The log keeps the contact's id, the names of
the fields a write changed and their values, each personal one as a
salted commitment. `erase` (ordered) archives a person and submits two
erasures of class `contact`, the contact's own as `erasure` and their
core person's as `details`, which the notary carries out as it settles:
their values and salts deleted from the vault, their fields redacted,
any later value for them refused. Their name, of class `profile`, is
core person's to erase.

## Shell

The `contacts` collection, archived ones left out, each with its client
stage, blank for a contact that is no client. Its `Clients` view, beside
`All`, keeps the contacts holding the role, a condition on `client` the
address keeps (`/contacts?v=clients`). A contact's page, its
header's crumb its id, its kind and form among its properties, shows its
role and sets it (`update`, the `client` field alone, a stage or none),
and edits its note (`update`, the note field alone). A person contact's page
reads their name, email and phone from core and links their entry in
People among its related. The data central to
it is in tabs after the first: what it owes and the invoices that bill
it, in Invoices (`contact-invoice`), and the projects it commissioned,
in Projects (`contact-project`).

## Import

Contacts from another tool's list, a CSV with the columns `name` and, if
it has them, `kind`, `form`, `email`, `phone`, `tags` and `note`: the
importer `contacts`, each line a `contact:contact:add` as the importing
member, which makes a contact that is no client. A contact the co-op
holds already, by its name, is refused. A person among them is a core
person known by their email as their address, so a person's line with
no email is refused; it is labelled by their line, never their name
([import](../import/index.md)).

## Lanterne

Nine contacts: the eight organisations Lanterne works for, mostly co-ops,
associations and small local firms, each an active client, and Margaux
Roux, a person whose `parent` is Les Halles, who runs its online shop
and is no client, since Lanterne bills Les Halles and not her. She is a
core person (`person.toml`), in People with no chip; what Lanterne knows
of her, her note, is the contact's:

| Contact | Form | Work |
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
contact's form matters to the rate card.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `core/sql/analytics.sql`, publishes `contact.contacts` to the analytics shell: each contact, by kind, client stage and whether it is archived. A company's name is shared; a person contact is shared by the address core person knows them by, whose name is core's, and no contact details are shared. It is scoped by `circle`, the circle that owns the contact. Its view is declared a published query, in `core/ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
