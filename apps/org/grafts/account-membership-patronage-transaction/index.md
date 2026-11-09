+++
title = "account-membership-patronage-transaction"
updated = 2026-11-09
+++

The work share employed in the associates' capital: once a year's
distribution posts, what each associate's part buys in shares is
credited to their capital account, by an effect citing it, and added to
the shares they hold; what each worker's part became, their own
statements, and the year's return to the federation. It joins four
feats because crediting a share needs the capital account (account), the
associate (member), the part (patronage) and the entry (transaction); it
builds on `account-membership-patronage` for the split and
`patronage-transaction` for the distribution's entry. Declared by
`patronage`.

## Schema

`account_membership_patronage_transaction` (`sql/`):

- `credit`: what each associate's part of a distribution's work share
  bought: the shares, their value, the capital account they credit, the
  day they are blocked until and the entry that posted them, one per
  associate and distribution.
- `employable(distribution)`: the associates whose part of a distributed
  split buys shares and who are not credited yet, in the order of their
  capital accounts. It runs as its owner, since whoever approved the
  split may read no colleague's part, and says no more than who, and
  that only to whoever reads the distribution in its circle and to a
  write; it is declared `audience: shared by ref` ([reading](../../../../_corpus/doc/architecture.md#reading)).

No trigger credits a distribution: what `424` owes in shares is paid
out by the writes that follow it, and what it still owes after them is
paid in cash, through a write of its own, not built.

The app role may select and insert; the guards role may select.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

`patronage:part:employ` (ordered, `approve-distribution` by motion), the patronage feat's, whose
handler is this graft's `employ`: what an associate's part of a
distributed split buys in shares, as `account_membership_patronage.split`
gives it, posted on the verdict date through the journal's `record`,
`424` (the work share owed) debited and their capital account under
`1013` credited, recorded in `credit`, and added to the shares they hold
by the membership feat's `crediting`. Its payload names the
distribution, the member, the entry and the motion; the guard reads the
shares and their value from the row the write made. It cites the motion
that approved the split, which `motion-patronage` checks.

## Reactions

- To `patronage:distribution:distribute`: `employ`, once for each
  associate `employable` names, in turn, each an effect citing
  the distribution in its transaction, its actor whoever signed the approval,
  and citing the same motion. A refused one is forgone, leaving the
  distribution and every other credit settled, and says why; what
  it would have bought stays owed in `424`. Where no associate's part
  buys a share, no write is made.

## Guards

- `account_membership_patronage_transaction.employs`, on
  `patronage:part:employ`: the member's part of the distribution buys
  shares, as the split gives on the verdict date; this write made their
  one credit, of exactly those shares at that value, blocked until the
  day the law sets, on a capital account under `1013` they hold, not
  frozen; and its entry posts exactly `424` debited and that account
  credited by it, and no other line, so it touches no cash account. That
  the shares were added to what the member holds is not checked: the
  membership feat keeps no history of a member's shares to read it from.

## Folds

A part employed in shares folds by
`account_membership_patronage_transaction.fold_employ`
(`sql/005-folds.sql`, [folds](../../../../_corpus/doc/architecture.md#folds)): the entry
by `transaction.fold_record`, the credit as its entry keeps it, and
the shares it buys added to what the member holds by
`membership.fold_credit`, as its handler calls `record` and
`crediting`. Its payload keeps the credit and the entry for it.

## Tests

`ts/_tests/credit.test.ts` (`cella test slice
account-membership-patronage-transaction`): no trigger credits a
distribution, so its entry posts the split alone; `employ` credits half
of an associate's part in whole shares, in an entry of its own, adds
them to what they hold, and names no worker who is no associate, who is
owed all of theirs; a credit posting anything beside `424` and the
capital account, or a second one for the same part, is refused.

## Reads

A credit reads as the member's capital account does, for the member and capital's readers (`sql/002-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)). The year's return to the federation, `federation(distribution)` (`sql/003-return.sql`), runs as its owner: its counts and sums are the co-op's, whole for every reader, and name no one, so it is declared `audience: shared by year` ([reading](../../../../_corpus/doc/architecture.md#reading)).

## Shell

Adds to a statement, in an Employed tab once its year is distributed,
what the part became:
owed in cash, until a write pays it out, in shares and how many,
blocked until when, and the capital account's movements with the
balance after each. Adds to a person's Own and decide tab, for the member alone, their
work share statements: each year's part, what it buys in shares and
what it pays, as credited once distributed. Finance reads every
statement in the `statements` collection, and a member their own. Adds
to a distribution's page, under a Return tab once it is distributed,
the year's return to the federation, each figure labelled in
English: the surplus and its split (loi n° 78-763, art. 33), the workers sharing the work share and
the associates among them, what it employed in shares and owed in cash
(Code du travail, art. R3323-11, L3324-10), the legal reserve and the
highest capital, the associates and the capital, and the capital the
employed associates hold, each with its source and whether it was
checked, and the whole as CSV. Which figures the CG SCOP's annual return
and its cooperative review ask for is not verified against their
forms, nor the article setting the employees' 51 % of the capital.

## Lanterne

The ten credits that follow the 2025 distribution, each signed by
Camille, who approved it, buy the ten members 270 shares, 13 500 €,
blocked until 1 June 2031, and leave 14 130 € to pay in cash.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `account_membership_patronage_transaction.credits` to the analytics shell: what each distribution credited to the members' capital, summed over every member, and the last day its shares are blocked until; and `account_membership_patronage_transaction.posted`, what each distribution's entry and the credits that follow it posted, account by account, a member's capital account summed into its parent's code, which the `report` feat's federation figures read. Both are shared: `credits` by `distribution`, and `posted` by `distribution` and `code`. `credits` is counted: `account_membership_patronage_transaction.credits_contributions` holds each member's credit, read by account's powers, which only the port reads, to withhold a distribution from a reader where open books does not share it; `posted`, the journal's, is not yet ([what is withheld](../../core/analytics/index.md#what-is-withheld)).
