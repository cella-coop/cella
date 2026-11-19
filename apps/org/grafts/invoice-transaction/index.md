+++
title = "invoice-transaction"
updated = 2026-11-19
+++

An issued invoice, its payments and its void post balanced transactions,
in the same database transaction as the invoice write and under the same
verdict.

## Postings

For a French SCOP's chart:

| Event | Debit | Credit |
|---|---|---|
| issue | `411` clients, the total | `706` services, the net; `44571` VAT collected, the VAT |
| payment | `512` the bank, the amount | `411` clients, the amount |
| void | `706`, the net; `44571`, the VAT | `411`, the total: the credit note |

A payment beyond what is owed leaves the client's `411` in credit: the
credit owed to them. A merged payment, a bank reference already recorded,
posts nothing.

## Schema

`invoice_transaction` (`sql/`):

- `invoice_transaction.posting`: the entry, the invoice, the event
  (`issue`, `payment`, `void`) and, for a payment, the invoice feat's
  payment id; one issue and one void per invoice.
- `invoice_transaction.lines(invoice, event)` and `.payment_lines(payment)`:
  the lines an event posts. The handlers ask the database for them, so the
  postings are SQL's, never TypeScript's.

The app role may select and insert postings; the guards role,
`cella_guards`, may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Guards

- `invoice_transaction.issued`, on `invoice:invoice:issue`, and
  `invoice_transaction.voided`, on `invoice:invoice:void`: the invoice has
  a posting for the event, dated on the issue or the void, whose lines are
  exactly the event's.

Payments are confluent and carry no guard; that their entry lands in an
open period is `account-transaction`'s trigger.

## Folds

The graft has no action of its own; it folds the invoice feat's issue,
payment and void, on which its handler writes its schema, by
`sql/002-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)), once the
invoice feat's fold has issued, paid or voided the invoice: the entry
each posted, its date, label and lines as its payload keeps them,
posted again by the transaction feat's `transaction.fold_record`, and
linked as the event it is, a payment's with its payment. A payment that
merged posted nothing, and folds nothing.

## Handlers

`issue`, `payment` and `annul` (the void) wrap the invoice feat's write
specs: the invoice's state, then the entry through the transaction feat's
`record`, then the posting, then `cella.submit` once, the payload carrying the entry
as the journal shows it (`logged`). A refusal by any guard
or trigger rolls all of it back; the void of a paid invoice leaves no
credit note behind.

## Shell

Adds an invoice's postings, line by line, to its page in a Postings tab,
with the payment and void forms; and replaces the invoice feat's issue, payment and void
with this graft's `issue`, `payment` and `annul`, which post in the same
verdict, reading the same forms through the invoice feat's `forms`.

## Import

Invoices to issue from a spreadsheet, a CSV with a row for each line,
rows sharing an `invoice` making one and an `address` column giving the
address billed, without which an invoice is refused at issue: the
importer `invoices`, each issued now as the importing
member, numbered in the coop's series and posted.
Invoices issued before cella are in the old books and come in through the
FEC as entries, so nothing is posted twice
([import](../../feats/import/index.md)).

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `invoice_transaction.postings` to the analytics shell: which entry posted which invoice or payment, and on what event. It is scoped by `circle`, the circle that owns each row. Its view is declared a published query, in `ts/src/api/contract.ts`, which the web shell serves through the port as the analytics shell reads it.
