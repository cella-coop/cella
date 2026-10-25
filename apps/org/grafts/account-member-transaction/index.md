+++
title = "account-member-transaction"
updated = 2026-10-25
+++

Members' capital in the books: what a member subscribes on joining and
pays in, what they draw on their account, the shares their part of a
year's work share buys, and, once they leave, their capital owed and
repaid, posted; and the year's return to the federation. It joins
three feats because
both need the chart (account), the member and the journal (transaction);
it builds on `account-member` and `account-transaction`. Declared by
`account`.

## Schema

`account_member_transaction` (`sql/`):

- `subscription`: each member's subscription, their capital account, the
  shares, what they cost, what the exit cancelled unpaid and the entry
  that posted them; `called`, each subscription against what is paid in
  and left to pay.
- `subscribes`, a trigger after a member's status changes from `invited`
  to `active`, in the write that admits them: their capital account opens
  under `1013`, next in the chart, and their shares at the share's value
  are called on the verdict date, `4562` (Apporteurs, capital appelé non
  versé) debited and `1012` (Capital souscrit, appelé, non versé)
  credited, as a SCOP's variable capital is called whole when it is
  subscribed. A subscription under the statutes' minimum is refused, and
  with it the write that admits. The books never hold an admission back
  otherwise: where no adopted terms value a share or the day's period is
  not open, the admission settles and nothing is subscribed. Being a
  trigger, it runs inside whichever write admits, the close of the
  admitting decision included.
- `paid`: each payment in on a subscription, its member, its entry and
  whether it came from the bank or was withheld from pay;
  `paying(account, cents)`, the lines a payment in posts: `512` debited
  and `4562` credited, and `1012` debited and the associate's account
  credited, what it pays moving to their paid-up capital.
- `withdraws`, a trigger after a member's status becomes `exited`, in the
  write that ends the membership, whichever it is: what their capital
  accounts hold moves to `4567` (Associés, capital à rembourser), what
  they had not paid of their subscription is cancelled, `1012` debited
  and `4562` credited, and their repayments are drawn up as the clauses
  governing the exit say, the capital divided evenly to the cent. With
  no clauses, no open period or no `4567`, the capital stays frozen where
  it is and nothing is drawn up.
- `repayment`: each repayment of a departed associate's capital, its
  number, the day it falls due, its amount, and the entry and day that
  paid it, which `stays_repaid` keeps once paid; `owed`, each one's
  repayments, repaid and left.
- `draw`: each draw, its member and its entry; `drawn`, each member's
  draws against their limit.
- `credit`: what each associate's part of an allocation's work share
  bought: the shares, their value, the capital account they credit, the
  day they are blocked until and the entry.
- `employs`, a trigger after an allocation's entry is linked, in the
  write that allocates: what `account_member.patronage` gives in shares
  posts as lines of the allocation's own entry, since a write posts one,
  `424` (the work share owed) debited by the whole and each associate's
  capital account credited by theirs, and their shares are added to what
  they hold. What `424` still owes is paid in cash, through a write of
  its own, not built. `employing(allocation)` gives those lines.

The app role may select and insert, set a subscription's cost and what
is cancelled and a repayment's entry and day; the rules role may select.

## Writes

`account:account:draw` (bounded on the draw limit, `self`), served on a
member's page: the bank pays the member, `455` debited and `512` credited,
on the verdict date, and the draw is recorded as theirs.

`account:capital:pay` (confluent, `record-receipt`), served on a member's
page while they owe some: money received from the bank on their
subscription, posted as `paying` gives it, and recorded as paid in.

`account:capital:repay` (ordered, `repay-capital`), served on a departed
member's page: the bank pays their next repayment, `4567` debited and
`512` credited, on the verdict date, and the repayment is paid.

## Rules

- `account_member_transaction.draws`, on `account:account:draw`: the draw
  is the actor's own, they are active, their capital account is not
  frozen, their draws with this one stay within their limit, and the
  entry is exactly the draw.
- `account_member_transaction.employed`, on `account:surplus:allocate`:
  what the allocation employed in shares is exactly what the terms give
  each associate, blocked until the day the law sets, and the
  allocation's entry posts exactly that to `424`'s debit and the capital
  accounts.
- `account_member_transaction.pays`, on `account:capital:pay`: the member
  has a subscription, the payment with every other leaves nothing
  overpaid, and the entry is exactly the payment in.
- `account_member_transaction.repays`, on `account:capital:repay`: the
  repayment exists and this write paid it, it has fallen due, every one
  before it is paid, and the entry is exactly it, `4567` debited and
  `512` credited.

At rung 1 the rule runs under the log's head lock, so two draws of one
member are judged one after the other. At rung 2 a device holds the limit
offline.

## Tests

`ts/_tests/capital.test.ts` (`cella test slice account-member-transaction`):
a capital account is held by a member; an admission subscribes, opening
the account and posting the shares; draws add up against the limit, and a
draw not the actor's own is refused; allocating employs half of an
associate's part in whole shares, as lines of the allocation's entry,
and pays a worker who is no associate all of theirs; an exit freezes
the capital, for good, moves what it held to `4567` and draws up its
repayments, and cancels what was not paid; a subscription under the
statutes' minimum is refused; a payment in moves what it pays to the
member's account, and one beyond what they owe or not exactly the
payment is refused; a repayment is refused before its day, out of its
turn, for the wrong amount or twice, and never changes once paid.

## Shell

Adds to a member's page their subscription, what they paid in, from the
bank or their pay, and what is left, with the form recording a payment
while some is; once they left, their repayments, each with its day and
whether it is paid, and the button paying the next; their capital in the
books, what they drew and what is left, the entry that subscribed it,
and, on their own page, the draw form, unless their account is frozen. Adds to a statement what the
part became: paid in cash, in shares and how many, blocked until when,
and the capital account's movements with the balance after each. Adds to
an allocation's page, under a Return tab once it is allocated, the
year's return to the federation: the surplus and its split (loi n°
78-763, art. 33), the workers sharing the work share and the associates
among them, what it employed in shares and paid in cash (Code du
travail, art. R3323-11, L3324-10), the legal reserve and the highest
capital, the associates and the capital, and the capital the employed
associates hold, each with its source and whether it was checked, and
the whole as CSV. Which figures the CG SCOP's annual return and the
révision coopérative ask for is not verified against their forms, nor
the article setting the employees' 51 % of the capital.

## Lanterne

The members' capital was carried over on 1 July. Inès subscribes her 20
shares, 1 000 €, called when d-2026-012 admits her and paid from her pay.
Paul left on 30 November 2025: his 1 500 € is owed him in `4567`, repaid
500 € a year on 30 November 2026, 2027 and 2028. Allocating 2025 buys the
ten members 270 shares, 13 500 €, blocked until 1 June 2031, and leaves
14 130 € to pay in cash.
