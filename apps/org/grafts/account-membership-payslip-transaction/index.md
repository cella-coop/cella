+++
title = "account-membership-payslip-transaction"
updated = 2026-11-09
+++

An associate's subscription paid in monthly instalments withheld from
their pay. It joins four feats because the instalment is the member's
debt on their capital account (account, member), withheld from their
payslip (payslip) and posted in the pay run's payment (transaction); no
graft of three sees all of it. It builds on `account-membership-transaction`,
whose subscriptions, payments in and `paying` lines it reads and adds to,
and on `payslip-transaction`, whose payment it adds lines to. Declared by
`account`.

## Schema

`account_membership_payslip_transaction` (`sql/`):

- `plan`: an associate's instalments, how many, the cents of each, the
  day they chose them and how many their pay had withheld before it;
  their own register, which spreading again replaces.
- `withheld`: what a month's pay withheld from each associate and the
  entry, the run's payment, that posted it.
- `due(month)`: what a month's run withholds from each associate on a plan
  with a payslip in it, while the plan has instalments left: an
  instalment, and on the plan's last all they still owe, never more than
  they still owe nor than their net pay. A month withholding anything
  counts as one instalment, whatever its amount, so a net pay below the
  instalment never stretches a plan past its count; once its last is
  withheld the plan withholds nothing more, and what is left is owed as
  any called capital is, paid in through the bank (`account:capital:pay`).
- `withholds(month)`, the lines a run's payment also carries, and
  `keeps(month, entry)`, which this graft's migration registers by
  `payslip-transaction`'s `payslip_transaction.register_payment_lines`,
  so the pay write asks for the lines before it records the payment's
  entry: each instalment due is withheld, posted as lines of the
  payment's own entry, since a write posts one, as a payment in through
  the bank, `512` debited and `4562` credited, which nets what the bank
  pays the associate, and `1012` debited and their capital account
  credited. Once the entry is posted the pay write calls `keeps`, which
  records each in `withheld`, this graft's own, and as paid in through
  their pay by `account-membership-transaction`'s published `pay_in`,
  its own code writing its own `paid`; this graft writes no journal line
  and no row of a lower-order graft itself, and puts no trigger on
  `payslip_transaction.posting`.

The app role may select, insert and update a plan, and insert what is
withheld; the guards role may select.

The cents of each instalment are personal data of class `books`,
registered by the member's address (`sql/003-salted.sql`): a spread's
payload commits to them, and the vault keeps them, so the log's digest
confirms no guess at what a colleague owes. Once a former member's
clock runs out `cella vault sweep` redacts them to NULL.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

## Actions

`account:capital:spread` (confluent, `spread-capital`, every member's right), served on a member's own page
while they owe some: what they owe is spread over as many monthly
instalments as they choose, each rounded up to the cent, from the verdict
date on. The statutes' ceiling counts every instalment the subscription
has had withheld from pay, under this plan or an earlier one, so
spreading again offers only what the ceiling has left.

## Guards

- `account_membership_payslip_transaction.spreads`, on `account:capital:spread`:
  they owe something, no more instalments than the statutes' clauses
  allow less those already withheld from their pay, the plan was set by this write, and it is their own.
- `account_membership_payslip_transaction.deducted`, on `payslip:run:pay`: the
  payment withheld exactly each instalment due, each recorded as paid in
  through pay, and its entry posts exactly those lines beyond the run's
  own.

## Folds

A spread folds by `sql/004-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)):
the member's plan from its entry's day, each instalment as its
commitment, counting the instalments their pay withheld before it. A
run's payment folds, once payslip-transaction's fold has posted it, into
what it withheld: each line its entry keeps that credits an associate's
capital account under 1013, which are this graft's alone, withheld from
its holder and paid in through their pay, as `keeps` kept it.

## Tests

`ts/_tests/instalments.test.ts` (`cella test slice
account-membership-payslip-transaction`): a plan beyond the statutes'
instalments, one this write did not set and one not the actor's own are
refused; paying a run withholds an instalment in its own entry, the bank
paying less by it and the capital account holding it, and both the
payment's guards pass; a payment that withholds less is refused; an
instalment never exceeds what is owed; spreading again over more than
the ceiling has left once instalments were withheld is refused; an
associate whose net pay is below their instalment has it withheld in
exactly the plan's count of months, the last all their net pay allows,
and nothing the month after, what is left still owed on their capital
account; lines that credit the bank are
refused by the payment's guard.

## Reads

A plan and what each run withheld read as the member's capital account does, for the member and capital's readers (`sql/002-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)).

## Shell

Adds to a person's Own and decide tab their instalments from pay: how many, each, since
when, and what each month's pay withheld; and, on their own page while
they owe some, the form spreading it. Adds to a payslip's Lines tab what
its pay withheld for capital, beside the net pay and what the bank paid.

## Lanterne

Once admitted, Inès spreads her 1 000 € over ten instalments of 100 €;
November's run, the first to pay her, withholds the first. Its payment
settles the net pay the run accrued and nothing else: `421` holds after
it what it held before, the 106,80 € Julien's approved expense `ex-0006`
is still owed until it is reimbursed.
