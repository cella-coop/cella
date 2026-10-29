+++
title = "VAT"
updated = 2026-10-30
+++

A document's lines, their amounts and their VAT (`@cella/org-vat`), the
one way every feat that bills or is billed counts them, so an invoice the
co-op issues and a bill it receives add up alike. The `invoice` and
`bill` feats each keep their own lines in their own schema and take the
arithmetic from here, never from each other.

## SQL

`sql/001-vat.sql` adds two pure functions beside the notary's in
`cella.*`, which every feat's SQL may call:

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
