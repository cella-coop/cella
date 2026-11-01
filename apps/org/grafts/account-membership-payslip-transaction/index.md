+++
title = "account-membership-payslip-transaction"
updated = 2026-11-02
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

- `plan`: an associate's instalments, how many, the cents of each and the
  day they chose them; their own register, which spreading again replaces.
- `withheld`: what a month's pay withheld from each associate and the
  entry, the run's payment, that posted it.
- `due(month)`: what a month's run withholds from each associate on a plan
  with a payslip in it: an instalment, never more than they still owe nor
  than their net pay.
- `withholds`, a trigger after a run's payment is linked, in the write that
  pays the run: each instalment due is withheld, posted as lines of the
  payment's own entry, since a write posts one, as a payment in through
  the bank, `512` debited and `4562` credited, which nets what the bank
  pays the associate, and `1012` debited and their capital account
  credited; and it is recorded as paid in through their pay.

The app role may select, insert and update a plan, and insert what is
withheld; the guards role may select.

The cents of each instalment are personal data of class `books`,
registered by the member's address (`sql/003-salted.sql`): a spread's
payload commits to them, and the vault keeps them, so the log's digest
confirms no guess at what a colleague owes. Once a former member's
clock runs out `cella vault sweep` redacts them to NULL.

## Actions

`account:capital:spread` (confluent, `spread-capital`, every member's right), served on a member's own page
while they owe some: what they owe is spread over as many monthly
instalments as they choose, each rounded up to the cent, from the verdict
date on.

## Guards

- `account_membership_payslip_transaction.spreads`, on `account:capital:spread`:
  they owe something, no more instalments than the statutes' clauses
  allow, the plan was set by this write, and it is their own.
- `account_membership_payslip_transaction.deducted`, on `payslip:run:pay`: the
  payment withheld exactly each instalment due, each recorded as paid in
  through pay, and its entry posts exactly those lines beyond the run's
  own.

## Tests

`ts/_tests/instalments.test.ts` (`cella test slice
account-membership-payslip-transaction`): a plan beyond the statutes'
instalments, one this write did not set and one not the actor's own are
refused; paying a run withholds an instalment in its own entry, the bank
paying less by it and the capital account holding it, and both the
payment's guards pass; a payment that withholds less is refused; an
instalment never exceeds what is owed; lines that credit the bank are
refused by the payment's guard.

## Reads

A plan and what each run withheld read as the member's capital account does, for the member and capital's readers (`sql/002-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)).

## Shell

Adds to a person's page their instalments from pay: how many, each, since
when, and what each month's pay withheld; and, on their own page while
they owe some, the form spreading it. Adds to a payslip's page what its
pay withheld for capital, beside the net pay and what the bank paid.

## Lanterne

Once admitted, Inès spreads her 1 000 € over ten instalments of 100 €;
November's run, the first to pay her, withholds the first.
