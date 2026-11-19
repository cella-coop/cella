+++
title = "VAT"
updated = 2026-11-19
+++

A document's lines, their amounts and their VAT (`@cella/org-vat`), the
one way every feat that bills or is billed counts them, so an invoice the
coop issues and a bill it receives add up alike. The `invoice` and
`bill` feats each keep their own lines in their own schema and take the
arithmetic from here, never from each other.

## SQL

The vat library has no SQL of its own: the two pure functions every
feat's SQL calls are the notary's, in `cella.*`
(`core/notary/sql/016-lines.sql`), since a core library makes nothing
outside its own schema and a feat reads no core library's schema but
the circles' and the register's
([architecture](../../../../_corpus/doc/architecture.md#sql)):

- `cella.line_amount(quantity numeric, unit_price bigint)`: a line's
  amount in cents, its quantity times its unit price rounded to the cent.
- `cella.line_vat(amount bigint, rate numeric)`: the VAT on a line's
  amount at a rate in percent (`5.50`), rounded to the cent. A document's
  VAT is the sum of its lines' VAT, so its VAT by rate adds up to it.

## TypeScript

- `Line`: a line as a write's request holds it: its description, its
  quantity as a decimal in text (`2.5`), its unit price in cents and its
  VAT rate in hundredths of a percent (`550` for 5,5 %), since a signed
  request holds integers only.
- `Taxed`: the net at one rate and the tax on it, in cents, as a
  document's VAT by rate reads.
- `lines(form, rate)`: the lines a form types, each field repeated once
  per line in order (`description`, `quantity`, `unit_price` in euros,
  `vat_rate` in percent, `rate` where it is left empty); a line without a
  description is dropped, and no line at all is refused.
- `priced(param)`: the SQL that reads the lines a write's request holds,
  passed as JSON in the parameter named, into rows numbered from 1 with
  each line's `amount` and `vat` in cents and its rate in percent, by
  `cella.line_amount` and `cella.line_vat`. A handler inserts its lines
  and sums its document's net and VAT from it, inside its own write.
