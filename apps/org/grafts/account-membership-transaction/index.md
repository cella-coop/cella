+++
title = "account-membership-transaction"
updated = 2026-11-02
+++

Members' capital in the books: what a member subscribes on joining and
pays in, what they draw on their account, and, once they leave, their
capital owed and repaid, posted. It joins three feats because each needs
the chart (account), the member and the journal (transaction);
it builds on `account-membership` and `account-transaction`. Declared by
`account`.

## Schema

`account_membership_transaction` (`sql/`):

- `subscription`: each member's subscription, their capital account, the
  shares, what they cost, what the exit cancelled unpaid and the entry
  that posted them; `called`, each subscription against what is paid in
  and left to pay.
- `paid`: each payment in on a subscription, its member, its entry and
  whether it came from the bank or was withheld from pay;
  `paying(account, cents)`, the lines a payment in posts: `512` debited
  and `4562` credited, and `1012` debited and the associate's account
  credited, what it pays moving to their paid-up capital.
- `withdrawal`: each departed associate's withdrawal, its entry, once;
  `holds(member)`, whether a withdrawal has anything to do: terms govern
  the verdict date, nothing is drawn up for them yet, and their capital
  accounts hold something or they owe some of their subscription. It runs
  as its owner, since whoever closed the motion may read no colleague's
  capital, and says no more than whether.
- `repayment`: each repayment of a departed associate's capital, its
  number, the day it falls due, its amount, and the entry and day that
  paid it, which `stays_repaid` keeps once paid; `owed`, each one's
  repayments, repaid and left.
- `draw`: each draw, its member and its entry; `drawn`, each member's
  draws against their limit.

The app role may select and insert, set what a subscription's exit
cancelled and a repayment's entry and day; the guards role may select.

The amount of a payment in and of a draw is personal data of class
`books`, registered by the member's address (`sql/004-salted.sql`):
each write's payload commits to it, and the vault keeps it, so the
log's digest confirms no guess at a colleague's capital. The journal
still shows the amount on the bank's line, as every member reads the
books. Once a former member's clock runs out `cella vault sweep` redacts
it to NULL. A repayment's amount is logged as given: it falls due after
its member has left, perhaps after their erasure, which refuses any
later value of their class, and the exit drew it up from the books.

## Actions

`account:account:draw` (bounded on the draw limit, `draw-account`, every member's right), served on a
person's page: the bank pays the member, `455` debited and `512` credited,
on the verdict date, and the draw is recorded as theirs.

`account:capital:pay` (confluent, `record-receipt`), served on a member's
page while they owe some: money received from the bank on their
subscription, posted as `paying` gives it, and recorded as paid in.

`account:capital:repay` (ordered, `repay-capital`), served on the page
of a departed member: the bank pays their next repayment, `4567` debited and
`512` credited, on the verdict date, and the repayment is paid.

`account:capital:subscribe` (ordered, `admit-member` by motion): a member admitted
subscribes their shares. Their capital account opens under `1013`, next
in the chart, by the account feat's `holding`, and their shares at the
share's value are called on the verdict date, `4562` (Apporteurs, capital
appelé non versé) debited and `1012` (Capital souscrit, appelé, non
versé) credited, as a SCOP's variable capital is called whole when it is
subscribed; the account under `1013` holds what they pay in.

`account:capital:withdraw` (ordered, `end-membership` by motion): a departed associate's
capital. What their capital accounts hold moves to `4567` (Associés,
capital à rembourser), what they had not paid of their subscription is
cancelled, `1012` debited and `4562` credited, and their repayments are
drawn up as the clauses governing the exit say, the capital divided
evenly to the cent.

Both cite the motion that admitted or ended the membership, registered
by `account-motion` in `motion.cites`, so each settles only if that
motion closed and passed.

## Reactions

What follows an admission or an exit is a write of its own after it,
signed by whoever signed that write, the member who closed the motion
that carried it, citing the same motion, and judged by its own guards; a
refused one leaves the admission or the exit settled and says why
([trust](../../../../_corpus/doc/trust.md#three-kinds-of-action)). No
trigger on `membership.member` does it.

- To `membership:member:admit`, whichever write admits, the close of
  the motion that admits included: `subscribe`. Where no adopted terms
  value a share on the verdict date, or the member holds none, nothing
  is subscribed and no write is made.
- To `membership:member:exit`: `withdraw`. Where no terms govern the
  exit, or the associate holds nothing and owes nothing, nothing is
  drawn up and no write is made; their capital stays frozen where it is.

## Guards

- `account_membership_transaction.draws`, on `account:account:draw`: the draw
  is the actor's own, they are active, their capital account is not
  frozen, their draws with this one stay within their limit, and the
  entry is exactly the draw its row records.
- `account_membership_transaction.pays`, on `account:capital:pay`: the member
  has a subscription, the payment with every other leaves nothing
  overpaid, and the entry is exactly the payment in its row records.
  Each reads the amount from the row its write made, since the payload
  commits to it.
- `account_membership_transaction.repays`, on `account:capital:repay`: the
  repayment exists and this write paid it, it has fallen due, every one
  before it is paid, and the entry is exactly it, `4567` debited and
  `512` credited.
- `account_membership_transaction.subscribes`, on
  `account:capital:subscribe`: the member is active and holds shares, at
  least the minimum of the terms governing the verdict date, which value
  a share; this write made their one subscription, of exactly their
  shares at that value, on a capital account under `1013` they hold; and
  the entry is exactly it, `4562` debited and `1012` credited.
- `account_membership_transaction.withdraws`, on
  `account:capital:withdraw`: the member has left; this write made their
  one withdrawal; their capital accounts hold nothing after it; and its
  repayments add up to what the entry credits `4567`, as many as the
  terms governing the exit say. That nothing posts into a closed month is
  `account-transaction`'s guard on every entry.

At rung 1 the guard runs under the log's head lock, so two draws of one
member are judged one after the other. At rung 2 a device holds the limit
offline.

## Tests

`ts/_tests/capital.test.ts` (`cella test slice account-membership-transaction`):
a subscription opens the account and posts the shares, and no trigger
subscribes an admission or withdraws an exit, so neither alone posts;
draws add up against the limit, and a draw not the actor's own is
refused; a withdrawal moves what an associate held to `4567`, draws up
its repayments and cancels what was not paid, once, and is refused for
a member who has not left; a subscription under the statutes' minimum,
or into a closed month, is refused; a payment in moves what it pays to the
member's account, and one beyond what they owe or not exactly the
payment is refused; a repayment is refused before its day, out of its
turn, for the wrong amount or twice, and never changes once paid.

## Reads

Subscriptions, payments in, draws, withdrawals and repayments read as the member's capital account does, for the member and capital's readers (`sql/003-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)); `drawn`, `called` and `owed` read as their reader.

## Shell

Adds to a person's page their subscription, what they paid in, from the
bank or their pay, and what is left, with the form recording a payment
while some is; once they left, their repayments, each with its day and
whether it is paid, and the button paying the next; their capital in the
books, what they drew and what is left, the entry that subscribed it,
and, on their own page, the draw form, unless their account is frozen.

## Lanterne

The members' capital was carried over on 1 July. Inès subscribes her 20
shares, 1 000 €, called by the subscription m-2026-012 carries once it admits her, signed
by Camille, who closed it, and paid from her pay.
Paul left on 30 November 2025: his 1 500 € is owed him in `4567`, repaid
500 € a year on 30 November 2026, 2027 and 2028.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `account_membership_transaction.capital_months` to the analytics shell: what the members subscribed, paid in, drew and were repaid, summed over every member, by month of the entry that posted it.
