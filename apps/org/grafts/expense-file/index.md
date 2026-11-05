+++
title = "expense-file"
updated = 2026-11-07
+++

The receipts on an expense: files of class `expense-receipt` about its
member, kept ten years as supporting vouchers (Code de commerce, art.
L123-22). Declared by `file`.

## Schema

`expense_file` (`sql/`): `receipt`, an expense and a file, each by id, a
file attached once.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

- `expense:expense:capture`, the expense feat's claim, replaced by one
  carrying its receipt: the claim, then the receipt stored and attached,
  in one write. A claim without one attaches nothing.
- `expense-file:expense:attach` (confluent, `claim-expense`, every employee's right): a receipt attached
  to an expense already claimed.

Each stores the receipt about the acting member, and the log commits to
its name and BLAKE3.

## Guards

- `expense_file.attaches`, on both: the receipt was uploaded by this write
  about the actor, of class `expense-receipt`, and is attached to their
  own expense, neither refused nor reimbursed.

## Folds

A claim carrying its receipt and a receipt attached fold by
`sql/002-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)),
once the expense feat's fold has made the claim: the file its entry
stored, by the file feat's fold of `storing`, as its handler stored it,
its name and BLAKE3 as the commitments its payload keeps, then attached
to the expense it names. A claim without one folds no receipt.

## Tests

`ts/_tests/expense-file.test.ts` (`cella test slice expense-file`): a
claim carrying its receipt, committed to in the log; a claim without one,
and one attached later; a receipt refused on someone else's expense and on
one reimbursed, leaving no file. `ts/_tests/folds.test.ts`: a claim's
receipt and one attached later fold stored, their name and bytes as
erasure leaves them, and attached; a claim without one attaches nothing.

## Shell

The expenses' New form, a claim with its receipt as a file; how many
receipts each expense holds; and on an expense's page its receipts, each
opening as its file, with another attached.

## Lanterne

Sofia's print proofs and Chloé's workshop coffee hold their receipts.
