+++
title = "account-membership-patronage-transaction"
updated = 2026-10-25
+++

The work share employed in the associates' capital: when a year's
distribution posts, what each associate's part buys in shares is
credited to their capital account, as lines of the distribution's own
entry, and added to the shares they hold; what each worker's part
became, their own statements, and the year's return to the federation.
It joins four feats because crediting a share needs the capital account
(account), the associate (member), the part (patronage) and the entry
(transaction); it builds on `account-membership-patronage` for the split and
`patronage-transaction` for the entry. Declared by `patronage`.

## Schema

`account_membership_patronage_transaction` (`sql/`):

- `credit`: what each associate's part of a distribution's work share
  bought: the shares, their value, the capital account they credit, the
  day they are blocked until and the entry.
- `employs`, a trigger after a distribution's entry is linked, in the
  write that distributes: what `account_membership_patronage.split` gives in
  shares posts as lines of the distribution's own entry, since a write
  posts one, `424` (the work share owed) debited by the whole and each
  associate's capital account credited by theirs, and their shares are
  added to what they hold. What `424` still owes is paid in cash, through
  a write of its own, not built. `employing(distribution)` gives those
  lines.

The app role may select and insert; the rules role may select.

## Rules

- `account_membership_patronage_transaction.credited`, on
  `patronage:distribution:distribute`: what the distribution employed in
  shares is exactly what the terms give each associate, blocked until the
  day the law sets, and the distribution's entry posts exactly its split
  and those shares, `424`'s debit and the capital accounts' credits, and
  no other line, so it touches no cash account.

## Tests

`ts/_tests/credit.test.ts` (`cella test slice
account-membership-patronage-transaction`): distributing employs half of an
associate's part in whole shares, as lines of the distribution's entry,
adds them to what they hold, and pays a worker who is no associate all of
theirs; an entry posting anything beside the split and the shares is
refused.

## Reads

A credit reads as the member's capital account does, for the member and capital's readers (`sql/002-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)). The year's return to the federation, `federation(distribution)` (`sql/003-return.sql`), runs as its owner: its counts and sums are the co-op's, whole for every reader, and name no one.

## Shell

Adds to a statement, once its year is distributed, what the part became:
paid in cash, in shares and how many, blocked until when, and the
capital account's movements with the balance after each. Adds to a
person's page, for the member alone, their work share statements: each
year's part, what it buys in shares and what it pays, as credited once
distributed. Finance reads every statement in the `statements`
collection, whose reads, like every read of the shell, are not yet
restricted. Adds to a distribution's page, under a Return tab once it is
distributed, the year's return to the federation: the surplus and its
split (loi n° 78-763, art. 33), the workers sharing the work share and
the associates among them, what it employed in shares and paid in cash
(Code du travail, art. R3323-11, L3324-10), the legal reserve and the
highest capital, the associates and the capital, and the capital the
employed associates hold, each with its source and whether it was
checked, and the whole as CSV. Which figures the CG SCOP's annual return
and the révision coopérative ask for is not verified against their
forms, nor the article setting the employees' 51 % of the capital.

## Lanterne

Distributing 2025 buys the ten members 270 shares, 13 500 €, blocked
until 1 June 2031, and leaves 14 130 € to pay in cash.
