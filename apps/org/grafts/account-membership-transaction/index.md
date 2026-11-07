+++
title = "account-membership-transaction"
updated = 2026-11-09
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
  credited, what it pays moving to their paid-up capital;
  `pay_in(entry, member, amount, via)`, its published write of a
  payment in, by which a graft above records one its entry posted, as
  `account-membership-payslip-transaction` records what a run's pay
  withheld.
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
books, and so does the payload, which keeps the entry's lines for its
fold. Once a former member's clock runs out `cella vault sweep` redacts
it to NULL. A repayment's amount is logged as given: it falls due after
its member has left, perhaps after their erasure, which refuses any
later value of their class, and the exit drew it up from the books.

Every record names its owning circle, `circle`, a foreign key into
core's circles ([owning
circle](../../../../_corpus/doc/architecture.md#sql)): the root's, the
assembly's, unless the write that makes it names another.

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

`account:capital:withdraw` (ordered, `exclude-member` by motion), and
`account:own:withdraw` (ordered, `withdraw-membership`, the associate's
own right): a departed associate's
capital. What their capital accounts hold moves to `4567` (Associés,
capital à rembourser), what they had not paid of their subscription is
cancelled, `1012` debited and `4562` credited, and their repayments are
drawn up as the clauses governing the exit say, the capital divided
evenly to the cent.

The subscription and an excluded associate's withdrawal cite the motion
that admitted or excluded them, registered
by `account-motion` in `motion.cites`, so each settles only if that
motion closed and passed; an associate who withdrew by their right
withdraws their own capital, citing none.

## Reactions

What follows an admission or an exit is an effect in its transaction,
citing it, its actor whoever signed that write: the member who closed the motion
that carried it, citing the same motion, or the member who withdrew, as
their own; and judged by its own guards; a
refused one is forgone and says why, and leaves the exit settled, while
the admission, which requires its subscription, is forgone with it
([trust](../../../../_corpus/doc/trust.md#three-kinds-of-action)). No
trigger on `membership.member` does it.

- To `membership:member:admit`, whichever write admits, the close of
  the motion that admits included: `subscribe`, an effect the admission
  requires (`cella.follows`). Where no adopted terms value a share on the
  verdict date, it writes nothing and its guard refuses it, forgoing the
  admission.
- To `membership:member:exclude`: `withdraw`; to
  `membership:member:withdraw`: `withdrawOwn`, the same withdrawal as
  `account:own:withdraw`. Where no terms govern the
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
  `account:capital:subscribe`: the member is active and holds shares that
  `account.subscribe_flaw` finds sound on the verdict date, at least the
  minimum of the terms governing it, which value a share, its month
  open; this write made their one subscription, of exactly their shares
  at that value, on a capital account under `1013` they hold; and the
  entry is exactly it, `4562` debited and `1012` credited. Its reasons
  say what would let it settle and name no person, since a subscription
  refused at a close is forgone and its reason kept in the log. Where
  `subscribe_flaw` finds the terms unsound, `subscribing` writes nothing
  and this guard refuses it with that reason, never the journal's.
- `account_membership_transaction.withdraws`, on
  `account:capital:withdraw` and `account:own:withdraw`: the member has
  left, and on `account:own:withdraw` left by their own withdrawal
  (`exit` is `withdrew`), so an excluded associate's capital moves only
  through the motion that excluded them; this write made their
  one withdrawal; their capital accounts hold nothing after it; and its
  repayments add up to what the entry credits `4567`, as many as the
  terms governing the day they exited say, whatever day the withdrawal
  settles. That nothing posts into a closed month is
  `account-transaction`'s guard on every entry.

At rung 1 the guard runs under the log's head lock, so two draws of one
member are judged one after the other. At rung 2 a device holds the limit
offline.

## Folds

Each action whose handler is this graft's folds by
`sql/006-folds.sql` ([folds](../../../../_corpus/doc/architecture.md#folds)): its own rows,
the entry it posts by `transaction.fold_record` and a subscription's
capital account by `account.fold_holding`, as its handler calls
`record` and `holding`; each payload keeps the entry it posts as
`logged` gives it, and a subscription the account's label as its
commitment. A payment in and a draw keep their amount as its commitment;
a repayment is paid on its entry's day; a withdrawal cancels what its
entry says and draws up its repayments by the SQL its handler runs, on
what its entry owes, which must draw as many as it says.

## Tests

`ts/_tests/capital.test.ts` (`cella test slice account-membership-transaction`):
a subscription opens the account and posts the shares, and no trigger
subscribes an admission or withdraws an exit, so neither alone posts;
draws add up against the limit, and a draw not the actor's own is
refused; a withdrawal moves what an associate held to `4567`, draws up
its repayments and cancels what was not paid, once, and is refused for
a member who has not left, and draws up repayments on the terms of the
day they exited even where later terms were adopted since; a
subscription under the statutes' minimum, or into a closed month, is
refused; a payment in moves what it pays to the member's account, and
one beyond what they owe or not exactly the payment is refused; a
repayment is refused before its day, out of its turn, for the wrong
amount or twice, and never changes once paid. A guard reads the action
it judges only while the notary judges it, so an associate's own
withdrawal, refused for one excluded before the exclusion's withdrawal
and after it, and drawn on the exit day's terms when it settles after
later ones were adopted, is the capital scenario's (`cella test e2e
capital`).

## Reads

Subscriptions, payments in, draws, withdrawals and repayments read as the member's capital account does, for the member and capital's readers (`sql/003-reads.sql`, [the pattern](../../../../_corpus/doc/architecture.md#sql)); `drawn`, `called` and `owed` read as their reader.

## Shell

Adds to a person's Own and decide tab their subscription, what they paid in, from the
bank or their pay, and what is left, with the form recording a payment
while some is; once they left, their repayments, each with its day and
whether it is paid, and the button paying the next; their capital in the
books, what they drew and what is left, the entry that subscribed it,
and, on their own page, the draw form, unless their account is frozen.

## Lanterne

The members' capital was carried over on 1 July. Inès subscribes her 20
shares, 1 000 €, called by the subscription that follows her admission in m-2026-012's
close, its actor Camille, who closed it, and paid from her pay.
Paul left on 30 November 2025: his 1 500 € is owed him in `4567`, repaid
500 € a year on 30 November 2026, 2027 and 2028.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `account_membership_transaction.capital_months` to the analytics shell: what the members subscribed, paid in, drew and were repaid, summed over every member, by month of the entry that posted it. It is shared by `month`. Each month is counted: `account_membership_transaction.capital_months_contributions` holds each member's capital moves in it, read by account's powers, which only the port reads, to withhold a month from a reader where open books does not share it ([what is withheld](../../core/analytics/index.md#what-is-withheld)).
