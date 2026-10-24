+++
title = "Conflicts"
updated = 2026-10-24
+++

# Conflicts

Every write in org's `ops.ts` files, paired against the invariants and the
other writes it can contend with, to test its label. The test for each pair
is the same: run it in both orders, then ask what breaks if both writes
were confluent. A write may be confluent only if every invariant it touches
holds in any order; it is bounded if the only thing that can break is a
right running out; otherwise it is ordered. Each invariant is owned at the
lowest level that sees all of it ([architecture](architecture.md#rules)).

This page recommends; the labels themselves change only in `ops.ts`, by
decision. Lanterne's state is that of 24 October 2026.

## The verdicts

| Write | Label | Verdict |
|---|---|---|
| `key.enrol` | confluent | **wrong**: ordered against revoke ([keys](#a-revoked-key-signs-nothing-new)) |
| `key.revoke`, `key.recover` | ordered | right |
| `circle.nest` | ordered | right, at rung 1 already |
| `circle.position.add`, `.remove` | ordered | right |
| `circle.mandate.grant`, `.revoke` | ordered | right |
| `circle.message` | confluent | right |
| `document.edit`, `.comment` | confluent | right |
| `document.adopt` | ordered | right |
| `account.draw` | bounded | right, but **duplicates** `transaction.debit` |
| `account.surplus.allocate` | ordered | right |
| `account.period.close` | ordered | right |
| `transaction.credit`, `.debit` | confluent, bounded | **wrong shape**: an entry both debits and credits |
| `transaction.adjust` | ordered, majority | ordered is right; **the decision is wrong** |
| `invoice.issue` | bounded | right; rung 2 needs late-write rules |
| `invoice.send` | confluent | right |
| `invoice.payment` | confluent | right; **its invariant is wrong** |
| `invoice.void` | ordered | right |
| `client.add`, `.update`, `.archive` | confluent | right; erasure must win |
| `member.invite`, `.profile` | confluent | right |
| `member.admit`, `.suspend`, `.exit` | ordered | right |
| `decision.propose` | confluent | right |
| `decision.vote` | confluent | right at rung 1; **needs a parent at rung 2** |
| `decision.close` | ordered | right |
| `notary.move` | ordered | right |

## Nothing posts into a closed period

Owner: the `account-transaction` graft. The period is an account's, the
entry a transaction's; only the graft sees both. Every write that posts an
entry contends with `account.period.close`: `transaction.credit`, `.debit`
and `.adjust` directly; `invoice.issue`, `.payment` and `.void` through
`invoice-transaction`; `account.draw` and `account.surplus.allocate`
through their grafts.

| Pair | Post first | Close first | Both confluent |
|---|---|---|---|
| any post vs `period.close` | the entry is in the period, which then closes with it | the entry is refused for that period | an entry lands in a period already closed and declared; the VAT return and the books disagree |

`period.close` works like `decision.close`: it fixes, by receipt order,
which entries made the period. That lets every post stay confluent or
bounded while the close alone is ordered. At rung 1 the graft's trigger
reads the period row `FOR SHARE` and the close updates it, so Postgres
serialises a post against a concurrent close.

**Rung 2.** A post made offline and dated in a period that closed before
it arrived needs a late-write rule. The accountant's practice is the rule
to adopt: the entry is refused for its period and re-dated into the first
open one, flagged as late.

**Lanterne.** Julien closed September on 5 October. Had Yusuf's phone,
offline at Clairval on 30 September, queued the 180 € plotter repair dated
that day, it would land on 6 October and post in October, flagged.

## An entry is balanced and permanent

Owner: the `transaction` feat.

`transaction.credit` and `transaction.debit` are seedling's single-sided
transactions. In double entry every entry both debits and credits: a
supplier payment debits `401` and credits `512`; an invoice payment debits
`512` and credits `411`. A "credit" write that is confluent and a "debit"
write that is bounded cannot describe one balanced entry, and which label
an entry gets would depend on which side the caller chose to name.

The spending authority `debit` carries (`bounded('share')`) is the same
right `account.draw` spends. Two writes spending one share can each pass
the check alone and together exceed it.

**Recommendation.** One write, `transaction.post`, confluent: an entry's
balance is checked on the entry alone, and sums of entries commute. The
authority to take money out is `account.draw`'s, bounded on the share,
which posts through `account-transaction`.

`transaction.adjust` posts a correcting entry. Two corrections of one
entry contend: both settle and the books are corrected twice.

| Pair | First settles | Second | Both confluent |
|---|---|---|---|
| `adjust` vs `adjust` of the same entry | the entry is corrected | refused: its base moved | the error is reversed twice |
| `adjust` vs `period.close` | as any post | as any post | as any post |

Ordered is right, but `decide: 'majority'` is not: an assembly vote for
every reversing entry makes the monthly close unworkable, and nothing in
the conflict needs one. The order comes from the base: an adjustment names
the entry it corrects and its current correction. Whether a correction also
needs a decision is the circle's rule, a parameter, not the write's type.

**Lanterne.** `je-0028`, the August VAT return, carries negative amounts
and a zero line. Julien corrects it with one reversing entry and one
correct entry; Hugo, reviewing on his laptop, must not be able to post a
second reversal of the same entry.

## Payments never exceed the total

Owner: the `invoice` feat; the payments are its collection.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `payment` vs `payment` | both recorded | both recorded | the same transfer recorded twice, or two payments that together exceed the total |
| `payment` vs `void` | void refused: a payment arrived | payment lands on a voided invoice | a voided invoice with cash against it; the credit note reverses revenue the client paid |

Payments are facts from the bank: refusing one does not return the money.
A confluent payment cannot uphold an upper bound, and an ordered one would
refuse a transfer that already happened. The invariant is better stated as
a reading than a refusal: **an invoice paid beyond its total shows the
excess as a credit owed to the client**, refunded or applied elsewhere.
The same bank reference recorded twice merges into one payment, which
removes the common case. [Architecture](architecture.md#rules) states the
rule as a refusal; it should change with this.

`void` is ordered against the payments: it settles only if no payment's
receipt precedes it. A payment that arrives after is an unapplied credit.
Both labels are right.

**Rung 2.** Julien records Vélo Solidaire's second 1 980 € on his phone in
a dead zone while Camille voids 0051 at the studio: the void settles, the
payment arrives later, and 0051 shows 1 980 € owed back or carried to its
reissue.

**Lanterne.** 0050 was voided the day after issue with nothing paid, so the
void settled and posted the credit note `je-0026`.

## Who votes

Owners: the `decision-member` graft for membership (admitted, suspended,
exited); the roll of a circle's decision needs positions too, which are the
`circle-member` graft's. A decision names its circle as text today, so the
roll has no owner yet: it needs a `circle-decision` graft.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `decision.vote` vs `decision.close` | the vote counts | the vote is too late | the outcome changes after it was announced |
| `decision.vote` vs `member.suspend` / `.exit` | the vote counts if suspension follows close | the vote is dropped | a suspended member's vote decides |
| `decision.close` vs `member.admit` | the new member was not on the roll | the new member is on the roll | the roll depends on which server saw what |
| `decision.close` vs `circle.position.add` / `.remove` | as admit | as admit | as admit |
| `decision.vote` vs `decision.vote`, same member | the later receipt counts | the later receipt counts | — |

The roll is not defined. The rule to adopt: the roll is the members active
and holding a position in the decision's circle at the close's receipt.
The alternative, the roll at the proposal's receipt, is closer to a ballot
list and harder to game; it is a question for the operator. Either way the
labels hold: votes confluent, close, admit, suspend, exit and positions
ordered.

**Rung 2.** "A member's latest stance counts" uses receipt order, which is
not signing order once one member has two devices offline. Hugo objects on
his laptop on 21 October and consents on his phone on the 23rd; if the
phone syncs last, his consent stands, as intended; if the laptop's queue
syncs last, his old objection wins. A stance should name the stance it
replaces, as an adoption names its base; two stances with the same parent
are concurrent, and the member is asked to restate. A vote signed offline
before the deadline and received after the close does not count.

**Lanterne.** Seven consents and Hugo's latest consent are in on
d-2026-012. Inès is not on its roll: her admission is what it decides.

## A mandate's limit

Owner: org's core, through `cella.may(actor, power, amount)`, which reads
mandates (the `circle` feat's) and positions (`circle-member`'s). It spans
every feat that spends, so it belongs below them all.

| Pair | Spend first | Revoke first | Both confluent |
|---|---|---|---|
| `account.draw` / `transaction.debit` vs `circle.mandate.revoke` | the spend stands | refused: no power | someone without authority spends |
| spend vs `circle.position.remove` | the spend stands | refused | as above |
| spend vs `member.suspend` / `.exit` | the spend stands | refused | as above |
| `account.draw` vs `account.draw`, one share | both, if the share covers both | both, if it covers both | the share is overspent |

The spend is bounded, the revocation ordered: a revocation stops new
shares, and spends within a share already granted stand. The loss a
revocation cannot stop is bounded by the share, which is the point of the
label. Both labels are right.

Lanterne's mandates carry `max_amount` with two meanings: Julien "pays
suppliers up to 3 000 €" (a cap per write) and a lead "spends up to
1 000 € for the circle" (a budget). A cap per write is a permission check;
a budget is a share that runs out. A mandate should name them apart.

**Rung 2.** A lead's phone holds the circle's share offline; a revocation
cannot reach it until it syncs. What it spends meanwhile stands, up to the
share. Shares should be small and expire.

**Lanterne.** Hugo, as Brand's lead, draws 600 € for print proofs on the
train while coordination revokes his `spend-circle` mandate: the draw
stands, his remaining 400 € is gone at the next sync.

## The circles form a tree

Owner: the `circle` feat.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `nest` X under Y vs `nest` Y under X | Y under X refused | X under Y refused | a cycle: neither circle reaches the assembly, and no power flows to either |
| `nest` vs `mandate.grant` in the moved circle | the grant is checked under the new parent | the grant may exceed what the new parent holds | a circle holds powers its parent does not |

Ordered is right, and needed at rung 1 already: two concurrent server
transactions can each see no cycle. The `ops.ts` comment ("two offline
nestings") understates it. `nest` should also check that the moved
subtree's mandates still fit within its new parent's.

**Lanterne.** Brand under Marketing and Marketing under Brand, proposed
the same afternoon by Hugo and Malik: the second is refused.

## A revoked key signs nothing new

Owner: the `key` feat; signatures are checked at ingress, before any rule.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `key.revoke` K vs a write signed by K | the write stands | the write is refused | a thief's writes count |
| `key.revoke` K vs `key.enrol` signed by K | the new device stays enrolled | the enrolment is refused | a stolen key enrols a device that outlives it |
| `key.recover` vs `key.recover` | the second refused | the first refused | two new keys for one address |
| `key.recover` vs `key.revoke` | as two orderings | as two orderings | an attacker's recovery survives the member's revocation |

`enrol` is labelled confluent, but it is not: enrol-then-revoke and
revoke-then-enrol end differently, and the first order lets a stolen key
plant a device the revocation does not touch. Enrolment is rare and cheap
to order. The alternative, revocation cascading to every key the revoked
key enrolled, also revokes devices the member enrolled legitimately.

Recovery is ordered, rightly; it should also open a window in which any
current key of the member cancels it.

**Rung 2.** Writes signed offline by a device before its revocation and
received after are refused; the member re-signs them from another device.

**Lanterne.** Hugo's old laptop was revoked on 12 May 2026. Had it been
stolen, an enrolment it signed on the 11th would still stand under the
current label.

## An adoption names what was read

Owner: the `document` feat for the base; that a decision approved the
adoption is the `decision-document` graft's.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `document.edit` vs `document.adopt` | the edit is in the draft, not the version | the edit is in the draft, not the version | no conflict: a version is an immutable frontier |
| `adopt` @2 vs `adopt` @3, same base | @3 refused: base moved | @2 refused | the adopted text depends on arrival order |
| `adopt` vs `decision.close` | adopt waits on the outcome | adopt settles if the outcome passed | adopted without consent |

The labels are right. The `ops.ts` comment "refused if that moved on" reads
as if editing the draft refuses an adoption; it does not, and must not, or
no living document could be adopted. What must not have moved is the
adopted version (`base: 'adopted'`).

**Lanterne.** Malik keeps editing the rate card after d-2026-011 names
version 2; if the decision passes on 9 November, version 2 is adopted as
read.

## Invoice numbers are gapless and chronological

Owner: the `invoice` feat.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `issue` vs `issue`, one series | the next number | the next number | duplicate numbers |
| `issue` vs `period.close` | as any post | refused for the period | an invoice dated in closed books |
| `issue` vs `mandate.revoke` of `issue-invoice` | stands | refused | issued without the power |

Bounded is right. At rung 1 the server holds the only series. **Rung 2**
gives each device a series of its own, and three things need rules first:

- an invoice is dated when issued and cannot be back-dated into a closed
  period; one issued offline whose period closed before it arrived is
  voided and reissued, not re-dated;
- a lost device leaves unused numbers: the gap is declared in the log;
- French law allows several series only if each is continuous and
  chronological, and some countries allow none: check before rung 2.

**Lanterne.** F-2026 runs to 0055. At rung 2, Julien's phone might hold
F-2026-J-0001 onwards for invoicing at a client's.

## A surplus is split once, and as the law requires

Owners: the `account` feat for the sums and the legal floors; the
`account-decision` graft for the approval.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `surplus.allocate` vs `surplus.allocate`, one year | the second refused | the first refused | the surplus is split twice |
| `surplus.allocate` vs `decision.close` | waits for the outcome | settles if it passed | split without the assembly |
| `surplus.allocate` vs the year's last `period.close` | refused: the year is open | settles | a split of a surplus not yet final |

All ordered; right.

**Lanterne.** d-2026-006 approved the 2025 split in June, after the 2025
books were closed: 45 % work, 40 % reserves, 15 % interest.

## Membership changes are decided

Owners: the `member` feat for status; the `decision-member` graft for the
deciding vote.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `member.admit` vs `member.invite` | refused: not invited | admitted | admitted without an invitation |
| `member.exit` vs `account.draw` | the draw is refused | the draw stands | an exited member spends |
| `member.exit` vs the capital account | — | — | no graft freezes it: `account-member` is missing |

`invite` and `profile` are rightly confluent; `admit`, `suspend` and `exit`
rightly ordered.

## Erasure wins

Owner: the feat holding the data (`client`, `member`), with the vault.

| Pair | A first | B first | Both confluent, last writer wins |
|---|---|---|---|
| erase a person vs `client.update` / `member.profile` | the update is erased | the update re-adds the data | personal data returns after erasure |

Field registers with the last writer winning are right for `client` and
`member.profile`, except against erasure: an erasure is a tombstone that
wins over every update, whichever arrives first. **Rung 2**: an update
queued offline before the erasure must not resurrect the data.

## Uncontested writes

| Write | Why nothing contends |
|---|---|
| `circle.message`, `document.comment` | appended; no rule reads them |
| `invoice.send` | idempotent; a send that races a void is followed by the void's credit note |
| `decision.propose` | a fact; the roll and the deadline are fixed by `close` |
| `member.invite` | two invitations do no harm |
| `client.add` | duplicates are merged by hand |
| `notary.move` | ordered against everything: writes received after its receipt go to the new server |

## Missing writes

The matrix found writes no `ops.ts` declares:

| Missing | Label it needs | Why |
|---|---|---|
| granting a share or a series | ordered | bounded writes spend rights nothing grants |
| `account.open` | ordered | account codes are unique in the scope |
| `document.version` | confluent | adoption names versions nothing saves |
| `invoice.draft` | confluent | issue numbers a draft nothing creates |
| erasing a person | ordered | the tombstone must be fixed in the log |

## Recommended label changes

1. `key.enrol`: confluent → **ordered**. Enrol and revoke do not commute;
   a stolen key can plant a device the revocation misses.
2. `transaction.credit` and `.debit` → **one `transaction.post`,
   confluent**. An entry debits and credits; the spending right is
   `account.draw`'s, so `debit`'s bounded share duplicates it.
3. `transaction.adjust`: `ordered({ decide: 'majority' })` →
   **`ordered({ base: 'corrected' })`**. The conflict is two corrections of
   one entry; a decision is the circle's parameter, not the write's type.
4. `invoice.payment` stays confluent; **its invariant changes** from a
   refusal to an overpaid credit, and payments merge by bank reference.
5. `decision.vote` stays confluent; **at rung 2 a stance names its
   parent**, since receipt order is not signing order across a member's
   devices.
6. No other label changes. `circle.nest`'s comment should say it is
   ordered at rung 1 too, and `document.adopt`'s that the base is the
   adopted version, not the draft.
