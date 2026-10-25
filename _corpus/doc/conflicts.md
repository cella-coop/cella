+++
title = "Conflicts"
updated = 2026-10-25
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
| `key.enrol` | ordered | **applied**: ordered against revoke ([keys](#a-revoked-key-signs-nothing-new)) |
| `key.revoke`, `key.recover` | ordered | right |
| `circle.nest` | ordered | right, at rung 1 already; **applied**: decided, and refused when a nesting settled first makes it a cycle ([tree](#the-circles-form-a-tree)) |
| `circle-member:position.add`, `.remove` | ordered | right; **applied**: moved from `circle` to the `circle-member` graft, which owns the relationship; both decided |
| `circle.mandate.grant`, `.revoke` | ordered | right; **applied**: decided, by the circle above the role's |
| `circle.message` | confluent | right |
| `document.create`, `.edit`, `.comment` | confluent | right |
| `document.version` | confluent | **applied**: declared; two saves are two versions, numbered under a lock |
| `document.adopt` | ordered | right; **applied**: the comment now names the adopted version, not the draft |
| `account.draw` | bounded | right; **applied**: a member's own, on the draw limit granted them ([capital](#capital-is-paid-in-and-repaid-by-the-statutes)) |
| `account.surplus.allocate` | ordered | right; **applied**: decided, citing the assembly's decision ([surplus](#a-surplus-is-split-once-and-as-the-law-requires)) |
| `account.terms.adopt` | ordered | right: decided, citing the members' decision; never over a year already allocated ([work share](#the-work-share-divides-as-the-years-terms-say)) |
| `account.period.close` | ordered | right |
| `account.capital.pay` | confluent | right: a deposit; payments commute, and at rung 1 none passes what is owed ([capital](#capital-is-paid-in-and-repaid-by-the-statutes)) |
| `account.capital.spread` | confluent | right: the associate's own register, the latest standing |
| `account.capital.repay` | ordered | right: each repayment once, in its turn and not before its day |
| `transaction.post` | confluent | **applied**: one write replaces `credit` and `.debit`; an entry's balance is checked on the entry alone |
| `transaction.pay` | confluent | right: entries commute; it is a write money leaves the bank through, under its own power, and a post touches no cash account; **applied**: `.payroll` is gone, pay runs post through `payslip` |
| `expense.capture`, `.submit` | confluent | right: the member's own facts |
| `expense.approve` | bounded on the approver's budget | right ([expenses](#an-expense-is-decided-once-within-a-budget)) |
| `expense.refuse`, `.reimburse` | ordered | right: one decision per expense, one payment |
| `expense-project:expense.rebill` | confluent | right: a register |
| `payslip:run.generate`, `.approve`, `.pay` | ordered | right ([pay](#a-pay-run-reads-approved-time)) |
| `transaction.adjust` | ordered, `base: 'corrected'` | **applied**: the decision is now a circle setting, not part of the label |
| `invoice.issue` | bounded | right; rung 2 needs late-write rules |
| `invoice.send` | confluent | right |
| `invoice.payment` | confluent | right; **applied**: overpayment is a credit owed, not a refusal; same reference merges |
| `invoice.void` | ordered | right |
| `client.add`, `.update`, `.archive` | confluent | right; **applied**: erasure wins ([erasure](#erasure-wins)) |
| `client.erase`, `member.erase`, `.forget` | ordered | right: a tombstone against every later value |
| `member.invite`, `.profile` | confluent | right; **applied**: an invitation carries the invitee's first device; erasure wins |
| `member.admit`, `.suspend`, `.exit` | ordered | right; **applied**: each decided; an admission settles inside its decision's close ([admission](#an-admission-settles-with-its-close)) |
| `decision.propose` | confluent | right; **applied**: what it decides is fixed with it, before any stance |
| `decision.vote` | confluent | right at rung 1; **needs a parent at rung 2** |
| `decision.close` | ordered | right; **applied**: a passing close admits, seats and enrols in its own verdict |
| `decision:message.post` | confluent | right: messages commute, each its author's, ordered by receipt; a closed decision takes none, as it takes no stance ([who votes](#who-votes)) |
| `project.create`, `project:milestone.add`, `.complete`, `project.archive` | confluent | right; rung 2 numbers milestones by device ([work](#work-is-registers)) |
| `project.budget` | ordered | right: against the shares ([shares](#a-share-never-exceeds-the-budget)) |
| `member-project:project.share` | bounded on the budget | right |
| `task.create`, `.move`, `.complete` | confluent | right: field registers, the last writer wins |
| `member-task:task.assign`, `project-task:task.file` | confluent | right: registers |
| `client-invoice:billing.link` | confluent | right: a register, the last writer wins; an invoice bills one client |
| `client-project:project.link`, `invoice-project:invoice.link` | confluent | right: registers, as `client-invoice`'s |
| `timesheet.log`, `timesheet:period.submit` | confluent | right |
| `timesheet:period.approve` | ordered | right: it fixes which entries were approved ([time](#no-time-goes-into-an-approved-month)); **applied**: within the approver's circles ([reach](#a-power-reaches-down-the-tree)); a worker who is no active member sits in no circle, so any holder of the power approves theirs |
| `worker.hire` | confluent | right: a fact; two hires of one worker cannot both stand, whichever comes first ([employment](#a-workers-time-and-pay-rest-on-their-employment)) |
| `member-worker:candidacy.open` | confluent | right: once to a worker, and only before they are a member |
| `timesheet-worker:entry.log`, `:period.submit` | confluent | right: the feat's log and submit by the worker's employment, contending as those do |
| `project-timesheet-worker:entry.book` | confluent | right: the feat's log by the worker's employment, booked to a project, contending as the log does and with an archiving as project-timesheet's booking does |
| `document-member:version.read` | confluent | right: the member's own register, its first day standing |
| `meeting.schedule`, `.minute` | confluent | right: a fact, and idempotent |
| `meeting:item.add`, `.move`, `.remove` | confluent | right: an item's place is its own register; fixed by the hold ([meetings](#a-meeting-is-held-once)) |
| `meeting.hold`, `.cancel` | ordered | right: one of them stands, and the hold fixes the agenda and who came |
| `meeting-member:attendance.mark`, `.record` | confluent | right: a register per member; fixed by the hold |
| `file.upload` | confluent | right: a fact, the uploader's own; two uploads commute ([files](#files-are-facts-and-imports-are-the-writes-they-carry)) |
| `expense-file:expense.attach`, `file-member:member.attach`, `file-worker:worker.attach` | confluent | right: facts, a file attached once; a receipt is refused once its expense is refused or reimbursed |
| `import:run.record` | confluent | right: the importer's own record; each line is the write it carries, with that write's label |
| `account-transaction:entry.carry` | confluent | right: entries add up in any order, and an account two carries open keeps the first's label |

## Nothing posts into a closed period

Owner: the `account-transaction` graft. The period is an account's, the
entry a transaction's; only the graft sees both. Every write that posts an
entry contends with `account.period.close`: `transaction.post`, `.pay`
and `.adjust` directly; `invoice.issue`, `.payment` and `.void` through
`invoice-transaction`; `account.draw` and `account.surplus.allocate`,
`expense.approve` and `.reimburse`, `payslip:run.approve` and `.pay`
through their grafts; and `member.admit`, whose subscription posts. An
admission never waits on the books: where the day's period is not open,
it subscribes nothing.

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

`transaction.credit` and `transaction.debit` were seedling's single-sided
transactions. In double entry every entry both debits and credits: a
supplier payment debits `401` and credits `512`; an invoice payment debits
`512` and credits `411`. A "credit" write that is confluent and a "debit"
write that is bounded cannot describe one balanced entry, and which label
an entry gets would depend on which side the caller chose to name.

The spending authority `debit` carried (`bounded('share')`) was the same
right `account.draw` spends. Two writes spending one share could each pass
the check alone and together exceed it.

**Applied.** One write, `transaction.post`, confluent: an entry's balance
is checked on the entry alone, and sums of entries commute. The authority
to take money out is the writes' that carry their own right: `pay`, a
member's `account.draw` on their limit, an expense's reimbursement and a
pay run's payment.

`transaction.adjust` posts a correcting entry. Two corrections of one
entry contend: both settle and the books are corrected twice.

| Pair | First settles | Second | Both confluent |
|---|---|---|---|
| `adjust` vs `adjust` of the same entry | the entry is corrected | refused: its base moved | the error is reversed twice |
| `adjust` vs `period.close` | as any post | as any post | as any post |

Ordered is right, but `decide: 'majority'` was not: an assembly vote for
every reversing entry makes the monthly close unworkable, and nothing in
the conflict needs one. **Applied.** The order comes from the base
(`ordered({ base: 'corrected' })`): an adjustment names the entry it
corrects and its current correction. Whether a correction also needs a
decision is the circle's rule, a parameter, not the write's type.

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
refuse a transfer that already happened. **Applied.** The invariant is
stated as a reading rather than a refusal: an invoice paid beyond its
total shows the excess as a credit owed to the client, refunded or
applied elsewhere. The same bank reference recorded twice merges into one
payment, which removes the common case.
[Architecture](architecture.md#rules) stated the rule as a refusal; it now
reads this way.

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
`circle-member` graft's. The roll, and whether a decision passes on it, are
the `circle-decision-member` graft's, which the decision feat declares.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `decision.vote` vs `decision.close` | the vote counts | the vote is too late | the outcome changes after it was announced |
| `decision.vote` vs `member.suspend` / `.exit` | the vote counts if suspension follows close | the vote is dropped | a suspended member's vote decides |
| `decision.close` vs `member.admit` | the new member was not on the roll | the new member is on the roll | the roll depends on which server saw what |
| `decision.close` vs `circle-member:position.add` / `.remove` | as admit | as admit | as admit |
| `decision.vote` vs `decision.vote`, same member | the later receipt counts | the later receipt counts | — |
| `decision:message.post` vs `decision.close` | the message is part of the deliberation | the message is refused: the deliberation is over | — |

**Applied.** The roll is fixed at the proposal: the members holding a
position in the decision's circle on the day it was proposed, of whom
those active at the close count. It is closer to a ballot list and harder
to game than a roll read at the close. The labels hold: votes confluent,
close, admit, suspend, exit and positions ordered. The procedure, its
share of the votes cast and its quorum, is fixed with the proposal too,
and a procedure any decision names cannot change, so the close counts
by the terms the members saw. Messages are confluent: the close orders
them as it orders stances, and none outlives it.

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

Owner: the `circle-member` graft, through `circle_member.may(actor, power,
cents, day)`, which reads mandates (the `circle` feat's), seats (its own)
and whether the member is active (the `member` feat's). It spans every
feat that spends, but org's core may read no feat's schema; each feat
names the power its ops need in `cella.power`, a core registry, and the
graft attaches its rule to every op listed, as `decision.cites` does for
the roll.

| Pair | Spend first | Revoke first | Both confluent |
|---|---|---|---|
| `expense.approve` vs `circle.mandate.revoke` | the approval stands | refused: no power | someone without authority spends |
| spend vs `circle-member:position.remove` | the spend stands | refused | as above |
| spend vs `member.suspend` / `.exit` | the spend stands | refused | as above |
| `expense.approve` vs `expense.approve`, one budget | both, if the budget covers both | both, if it covers both | the budget is overspent |

The spend is bounded, the revocation ordered: a revocation stops new
shares, and spends within a share already granted stand. The loss a
revocation cannot stop is bounded by the share, which is the point of the
label. Both labels are right.

Lanterne's mandates carried `max_amount` with two meanings: Julien "pays
suppliers up to 3 000 €" (a cap per write) and a lead "spends up to
1 000 € a month for the circle" (a budget). A cap per write is a
permission check; a budget is a share that runs out. **Applied.** A
mandate names them apart: `limit` caps a single write, in cents;
`budget`, with `per` ("month" or "year"), caps a cumulative total over a
period. **Applied**: a budget is enforced on the writes that spend it,
by the graft that sees the mandate, the seat and the spend:
`circle-expense-member` sums what the approver approved over the
budget's period, this approval included. Two approvals by one member are
judged one after the other under the log's head lock.

**Rung 2.** A lead's phone holds the circle's share offline; a revocation
cannot reach it until it syncs. What it spends meanwhile stands, up to the
share. Shares should be small and expire.

**Lanterne.** Hugo, as Brand's lead, approves Sofia's 180 € print proofs
on the train while coordination revokes his `approve-expense` mandate:
the approval stands, his remaining 820 € is gone at the next sync.

## The circles form a tree

Owner: the `circle` feat.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `nest` X under Y vs `nest` Y under X | Y under X refused | X under Y refused | a cycle: neither circle reaches the assembly, and no power flows to either |
| `nest` vs `mandate.grant` in the moved circle | the grant is checked under the new parent | the grant may exceed what the new parent holds | a circle holds powers its parent does not |

Ordered is right, and needed at rung 1 already: two concurrent server
transactions can each see no cycle. The `ops.ts` comment ("two offline
nestings") understated it; **applied**, it now says a cycle can form even
online. **Applied**: each circle keeps its path from the assembly; the
tree's trigger refuses a cycle the write itself sees, and `circle.nests`,
run under the log's lock, refuses one a nesting settled first made, as
the second's path no longer follows its parent's. `nest` should also
check that the moved subtree's mandates still fit within its new
parent's; it does not yet.

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

`enrol` was labelled confluent, but it is not: enrol-then-revoke and
revoke-then-enrol end differently, and the first order lets a stolen key
plant a device the revocation does not touch. **Applied**: `enrol` is now
ordered. Enrolment is rare and cheap to order. The alternative, revocation
cascading to every key the revoked key enrolled, also revokes devices the
member enrolled legitimately.

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

The labels are right. The `ops.ts` comment "refused if that moved on" read
as if editing the draft refuses an adoption; it does not, and must not, or
no living document could be adopted. What must not have moved is the
adopted version (`base: 'adopted'`). **Applied**: the comment and the doc
now say so.

A decision names the content it adopts by its canonical hash
([trust](trust.md#what-a-decision-adopts)), so a version saved later with
other content cannot ride on its consent, and one saved at the same
frontier, holding the same content, can.

**Lanterne.** Malik keeps editing the rate card after d-2026-011 names
version 2 by its hash; if the decision passes on 9 November, version 2 is
adopted as read.

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

Owners: the `account` feat for the sums and the floors it sees; the
`account-transaction` graft for the legal reserve's, which needs the
books; the `account-decision` graft for the approval.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `surplus.allocate` vs `surplus.allocate`, one year | the second refused | the first refused | the surplus is split twice |
| `surplus.allocate` vs `decision.close` | waits for the outcome | settles if it passed | split without the assembly |
| `surplus.allocate` vs the year's last `period.close` | refused: the year is open | settles | a split of a surplus not yet final |
| `surplus.allocate` vs a post to `1061` or to capital | the floor was read before it | the floor reads it | the legal reserve's 15 % waived on a reserve or a capital that moved |

All ordered; right. **Applied**: the floors are those of loi n° 78-763
du 19 juillet 1978, art. 33, read on Légifrance in its text in force since
2 August 2014: 15 % to the legal reserve until it reaches the highest
amount the capital reached (1°), a development fund (2°), at least 25 %
to the workers (3°), and interest on capital no more than the reserves'
allocations nor the workers' (4°). The rules cite the article when they
refuse.

**Lanterne.** d-2026-006 approved the 2025 split in June: 45 % work,
15 % legal reserve, 25 % development fund, 15 % interest. Its result was
carried over unallocated, and allocating it cites the decision.

## The work share divides as the year's terms say

Owners: the `account` feat for the terms, the portions and their sums;
the grafts that know each basis for its parts: `account-payslip` by pay
and in equal parts, `account-timesheet` by time worked; `account-member`
for the split between shares and cash; `account-member-transaction` for
the shares posted; `account-decision` for the adoption.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `surplus.allocate` vs `terms.adopt` over its year | the adoption refused: the year is allocated | the allocation divides by the new terms | a split made by terms adopted after it |
| `surplus.allocate` vs a salary or `timesheet:period.approve` in its year | the parts were fixed by the allocation | the parts read it | parts that no longer add up to what was paid or worked |
| `surplus.allocate` vs `member.exit` | the shares are credited, then frozen with the rest | all of the part is paid in cash | shares issued to someone who has left |
| `terms.adopt` vs `terms.adopt`, one year | the later adopted governs | the later adopted governs | two terms for one year |

All ordered; right. **Applied**: the parts are made by triggers in the
write that allocates, from the terms, the salaries, the approved time
and the members as they stand at its verdict, and never change after;
each basis's rule checks its parts against what it gives, and
`account.divides` that each portion adds up. The work share divides by
pay, time worked, equal parts or a mix (Code du travail, art. L3324-5;
BOI-BIC-PTP-10-30, § 170 and 280), among every employee, associate or
not (loi n° 78-763, art. 33, 3°); shares bought with it are reserved to
the associates employed (art. R3323-11) and blocked five years from the
first day of the sixth month after the year (art. L3324-10). A write
posts one entry, so the shares are lines of the allocation's.

**Lanterne.** The statutes' terms, `st-2021`, divide the work share by
pay and employ half of each associate's part in shares at 50 €.

## Membership changes are decided

Owners: the `member` feat for status; the `decision-member` graft for the
deciding vote.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `member.admit` vs `member.invite` | refused: not invited | admitted | admitted without an invitation |
| `member.exit` vs `account.draw` | the draw is refused | the draw stands | an exited member spends |
| `member.exit` vs the capital account | — | — | a graft joining member and the books freezes it in the exit's transaction, on the exit's update of the status |
| `member.invite` vs `member.invite`, one device key | the second refused: the key is carried | the first refused | one device enrolled for two members |
| `member.suspend` vs `decision.vote` by that member | the stance refused: not active | the stance stands; if before the close, it is counted only if they are active at the close | a suspended member's stance decides |

`invite` and `profile` are rightly confluent; `admit`, `suspend` and `exit`
rightly ordered. **Applied**: suspension and exit are decided, citing the
assembly's decision, and carried out once its close settles; until then
they needed a power no mandate granted.

## An admission settles with its close

Owners: the `circle-decision-member` graft, which counts the roll; the
`member` feat, `circle-member` and `key-member` for the state each
admission changes.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| close admitting M vs `circle-member:position.add` of M | the seat refused: M sits there | the close refused, all of it: M already sits | an admitted member twice seated, or seated and not admitted |
| close admitting M vs the admission alone | — | — | an active member with no seat and no device, who cannot vote or sign |
| `decision.propose` vs `decision.vote` on it | the motion is fixed before the stance | no motion is added after it | members consent to one thing and are counted for another |

The close, the admissions it makes, their seats and the devices their
invitations carried settle in one transaction under one verdict, or not
at all. Before, the close settled and each admission and seat followed as
writes of their own, and a refused seat left an active member with none.
**Applied**: the decision feat's close is a write a graft extends, and
`circle-decision-member` extends it; the rules of each slice run on the
close (`decision_member.closes`, `circle_decision_member.settles`, and
`key-member`'s trigger). What else a decision decides, a suspension, a
seat, a nesting, a mandate, is carried out after the close, each its own
decided write: a refusal there leaves the decision passed and the motion
undone, which its outcome shows.

**Lanterne.** d-2026-012 closes on 31 October: Inès is admitted with her
20 shares, seated in the assembly and her laptop enrolled, in one verdict.

## A power reaches down the tree

Owners: the `circle-member` graft for how far a power reaches
(`circle_member.over`); `circle-member-timesheet` and
`circle-member-project` for what a write concerns.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `timesheet:period.approve` by a lead vs `circle-member:position.remove` of the member | approved | refused: the member no longer sits in the lead's circle | a lead approves the time of someone who left the circle |
| `project.budget` by a lead vs `circle.nest` of the project's circle away | set | refused: the circle is no longer within the lead's | a lead budgets another circle's project |

A power held through a seat reaches the seat's circle and the circles
within it, never above or across. Both writes are ordered, and so are
seats and nestings, so the reach is read under the log's lock.

**Lanterne.** Hugo, Brand's lead, may not approve Thomas's October, which
is Web's; Yusuf may.

## Erasure wins

Owner: the feat holding the data (`client`, `member`), with the vault.

| Pair | A first | B first | Both confluent, last writer wins |
|---|---|---|---|
| erase a person vs `client.update` / `member.profile` | the update is erased | the update re-adds the data | personal data returns after erasure |

Field registers with the last writer winning are right for `client` and
`member.profile`, except against erasure: an erasure is a tombstone that
wins over every update, whichever arrives first. **Applied**:
`client.erase`, `member.erase` and `member.forget` are ordered, and the
notary, under the log's lock, refuses any later value of an erased
subject's class (`vault.erased`); an update that settled first is erased
with the rest. **Rung 2**: an update queued offline before the erasure
must not resurrect the data.

## A share never exceeds the budget

Owner: the `member-project` graft, which sees both the budget (the
`project` feat's) and the shares (its own).

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `share` vs `share`, one project | both, if what is left covers both | both, if it covers both | the budget is overspent |
| `share` vs `budget` lowered | the budget is refused below the shares | the share is refused beyond the new budget | shares above the budget |
| `share` vs `archive` | the share stands | refused: the project is archived | a share of a frozen project |
| `share` vs `circle.mandate.revoke` of `set-budget` | the share stands | refused: no power | as any spend ([a mandate's limit](#a-mandates-limit)) |

The share is bounded, as `account.draw` is: the only thing two shares can
break together is the budget running out, the right they spend. Setting
the budget is ordered against them, by `member_project.covers`. At rung 1
the share's trigger locks the project's row, so shares and a budget
change are serialised. **Rung 2**: a lead's device holds a slice of the
budget offline and grants shares from it.

**Lanterne.** Hugo grants Sofia 13 000 € of Ferrand's packaging budget
while 12 000 € is left: refused. Once he grants her 600 € beside his own
2 000 €, lowering the budget to 2 000 € is refused too.

## No time goes into an approved month

Owner: the `timesheet` feat; the entries and the months are its own.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `log` vs `approve`, same month | the entry is in what was approved | the entry is refused | an entry lands in a month already approved, and paid or counted on it |
| `submit` vs `approve` | the approval settles | refused: not submitted | approved without its member's say |
| `approve` vs `approve` | the second refused | the first refused | approved twice, by two people |
| `log` vs `log` | both stand | both stand | — |

`approve` works like `account.period.close`: it fixes, by receipt order,
which entries made the month, so every log stays confluent while the
approval alone is ordered. At rung 1 the entry's trigger reads the month
`FOR SHARE` and the approval updates it. A day of more than 24 hours is
two logs each fine alone, so it is not refused; it reads as an anomaly.

**Rung 2.** An entry logged offline for a month approved before it
arrived needs a late-write rule, as a post into a closed period does: it
is refused for its month and logged into the first open one, flagged.

**Lanterne.** Thomas logs the 30 October on 2 November, after Yusuf
approved his October that morning: refused.

## Work is registers

Owners: the `task` feat for a task's fields; `member-task` for its
assignee; `project-task` for its project; `project` for milestones.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `task.move` vs `task.move` | the later receipt's status | the later receipt's status | — |
| `task.move` vs `task.complete` | done | moved, its day cleared | — |
| `assign` vs `assign` | the later receipt's assignee | the later receipt's | — |
| `file` vs `project.archive` | the task stays in the archived project | refused: archived | a task filed into a frozen project |
| `milestone.add` vs `milestone.add` | numbered n and n+1 | numbered n and n+1 | two milestones numbered n |

A task's fields are registers, the last writer winning each, so every
task write is confluent. Filing into a project archived meanwhile is
harmless and reads as such. **Rung 2**: milestones numbered under the
project's lock collide when two devices add one offline; a milestone
needs an id of its own, its number a position.

## Capital is paid in and repaid by the statutes

Owners: `account-member` for the freeze, a trigger on the member's
status in the write that ends the membership, whichever it is;
`account-member-transaction` for the draws, the subscription, the
payments in and, on exit, the move to what is owed and the repayments;
`account-member-payslip-transaction` for the instalments withheld from
pay; the `account` feat for the statutes' clauses.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `account.draw` vs `member.exit` | the draw stands, within the limit | refused: the account is frozen | a departing member empties their account |
| `account.draw` vs `account.draw`, one member | both, if the limit covers both | both, if it covers both | the limit is overdrawn |
| `member.admit` vs `account.period.close` of its month | the subscription posts in the month | nothing is subscribed; the admission settles | an admission refused by the books |
| `account.capital.pay` vs `account.capital.pay`, one member | both, if what is owed covers both | both, if it covers both | a subscription paid beyond what it cost |
| `account.capital.pay` vs `member.exit` | the payment stands; the exit cancels the rest | refused: the exit cancelled what was owed | money taken on a cancelled subscription |
| `payslip:run.pay` vs `account.capital.spread` | the instalment at the old plan | at the new one | none: the payment reads the plan that stands |
| `account.capital.repay` vs `account.capital.repay`, one repayment | the second refused: it is paid | the first refused | a repayment paid twice |
| `member.exit` vs `account.period.close` of its month | the capital moves to 4567 and is drawn up | nothing moves; the capital stays frozen | an exit refused by the books |

The draw is bounded on the member's limit, a right granted in advance;
the exit is ordered and freezes in its own transaction, so no draw
settles between the exit and the freeze. A frozen account never thaws;
what it held moves to 4567 in the same write and is repaid from there.
Subscribing never holds an admission back, but for the statutes'
minimum. A payment in is a deposit, so it is confluent; at rung 2 two
offline payments could pass what is owed, which the server's rule
refuses today and which then needs a late-write rule, as an invoice's
overpayment has. A repayment is ordered: it is paid once, and after the
one before it.

**Lanterne.** Thomas draws 300 € of his 500 €; a second 300 € is refused,
200 € being left. Had Sofia left, her account would freeze in the exit's
own verdict, and her draw after it would be refused. Inès's 20 shares are
called in the verdict that admits her, and she spreads them over ten
instalments, the first withheld when November's run is paid. Paul, who
left in November 2025, is owed 1 500 € in three yearly repayments; the
first is refused on 29 November 2026 and paid on the 30th, once.

## An expense is decided once, within a budget

Owner: the `expense` feat for the lifecycle; `circle-expense-member` for
the budget; `circle-member` for the power and its limit.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `approve` vs `refuse`, one expense | refused: it is approved | refused: it is refused | an expense both paid and refused |
| `approve` vs `approve`, one expense | the second refused: approved already | as A | charged twice |
| `approve` vs `circle.mandate.revoke` | the approval stands | refused: no power | as any spend |
| `approve` vs `approve`, one approver's month | both, if the budget covers both | both, if it covers both | the budget overspent |
| `reimburse` vs `reimburse` | the second refused | as A | paid back twice |

`approve` is bounded on the approver's budget; `refuse` and `reimburse`
are ordered, since only one decision and one payment may stand. At rung 1
the lifecycle trigger refuses the second of each.

**Lanterne.** Hugo approves Sofia's 180 € proofs; her 960 € plotter repair
is beyond what is left of his 1 000 €, and Camille approves it as
gérante, within her 2 000 € limit; Thomas's 2 520 € laptop is beyond
even hers, and needs the assembly.

## A pay run reads approved time

Owners: the `payslip` feat for the run; `payslip-timesheet` for the time
it reads; `payslip-transaction` for its postings.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `generate` vs `timesheet:period.approve`, one month | refused: a month is not approved | the run reads the approved time | pay computed from time still changing |
| `generate` vs `timesheet.log` into the month | the log is refused once approved | as A | as above |
| `generate` vs `generate`, one month | the second refused | as A | two runs for a month |
| `approve` vs `pay` | the payment follows | refused: not approved | pay leaves the bank before it is approved |
| `pay` vs `pay` | the second refused: paid | as A | paid twice |
| `approve` vs `account.period.close` of the month | the accrual lands in the month | refused: the month is closed | as any post |

All three are ordered. The run waits for every month's approval, which
is ordered and fixes the month's entries, so the time a run reads never
changes after it.

**Lanterne.** October's run is refused on 2 November until every
worker's October is approved, Inès's with the members'; prepared then,
approved by Camille, it accrues on 31 October and Julien pays it from
the bank.

## A worker's time and pay rest on their employment

Owners: the `worker` feat for the contract; `timesheet-worker` and
`payslip-worker` for the time and pay that rest on it; `member-worker`
for the candidacy.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `hire` vs `hire`, one worker | the second refused | the first refused | two contracts for one person, neither the other's end |
| `hire` vs `timesheet-worker:entry.log` by them | the log stands | refused: no worker | — |
| `candidacy.open` vs `candidacy.open`, one worker | the second refused | as A | two probations, two pledges |
| `candidacy.open` vs `member.admit` | the admission follows | refused: a member is no candidate | — |
| `timesheet-worker:entry.log` vs `timesheet:period.approve` | as the feat's log | as the feat's log | as the feat's log |

Every write is a fact, the hire and the candidacy once each, so all stay
confluent: what can break is only a second of one, which the key
refuses in either order. Ending a contract is not built; it will contend
with the logs and payslips of the days after it, as approving a month
does with its entries, and be ordered.

**Lanterne.** Inès, hired in September 2025 and no member, logs her own
time and is paid in October's run; Camille hires Bastien, an apprentice,
and opens his candidacy, and opening one for Yusuf, a member, is
refused.

## A meeting is held once

Owners: the `meeting` feat for the meeting and its agenda;
`meeting-member` for who came; `circle-meeting-member` for who is
expected and who may record them.

| Pair | A first | B first | Both confluent |
|---|---|---|---|
| `hold` vs `cancel` | the cancel refused: held | the hold refused: cancelled | a meeting both held and cancelled |
| `hold` vs `item.add`, `.move`, `.remove` | the edit refused: the agenda is fixed | the item is in the agenda held | an agenda changed after the meeting it records |
| `hold` vs `attendance.mark`, `.record` | the mark refused: who came is fixed | the mark counts | who came, and the quorum, change after the meeting |
| `item.move` vs `item.move`, two items | both stand | both stand | — |
| `item.move` vs `item.move`, one item | the later receipt's place | the later receipt's place | — |
| `item.move` vs `item.remove` | the item is removed | the move refused: no item | — |
| `attendance.mark` vs `attendance.record`, one member | the later receipt's mark | the later receipt's mark | — |
| `minute` vs `minute` | one document, the first's | one document, the first's | two documents of one meeting's minutes |

Hold is ordered, as a month's approval is: it fixes, by receipt order,
which items made the agenda and who was marked, so every edit and mark
stays confluent while the hold alone is ordered. At rung 1 the item and
attendance triggers read the meeting `FOR SHARE` and the hold updates
it. A move sets only its own item's position, the midpoint of its new
neighbours', so two moves of different items never touch one row; an
item's place is a register, its last move winning. Quorum is read from
the marks and the seats on the meeting's day, after the hold, and
refuses nothing.

**Rung 2.** Positions are numbers the server picks; two devices moving
offline can pick one, so an item needs a fractional index of its own,
as a milestone needs an id. A mark made offline before the hold and
received after it needs a late-write rule: refused, and the minutes say
who came. Minutes begun on two devices offline make two documents; the
second should take the first's on sync.

**Lanterne.** Malik holds coordination on 2 November while Hugo, on his
phone, marks himself present: had the mark arrived first it would
count; arriving after, it is refused and he stays excused.

## Files are facts, and imports are the writes they carry

Owners: the `file` feat for the files; `expense-file`, `file-member` and
`file-worker` for what each attaches; the `import` feat for the record;
`account-transaction` for the carry.

A file never changes, so uploading one is a fact: `file.upload`, and the
grafts' writes that store a file and attach it, `expense-file:expense.attach`,
`file-member:member.attach` and `file-worker:worker.attach`, are
confluent. Two attached commute, a file is attached once, and a receipt
is refused once its expense is refused or reimbursed, which the expense
feat orders. The claim that carries its receipt is `expense.capture`
with the file in the same write, as confluent as the claim.

An import adds no write of its own beyond its record,
`import:run.record`, a confluent fact: each line is the write it would be
by hand, with that write's label, so a FEC's entry is as confluent as a
post and an imported invitation as an invitation. Carrying an entry over,
`account-transaction:entry.carry`, opens the accounts it names that the
chart lacks; two carries opening one code keep the first's label and the
second reads it, so opening within a carry commutes, unlike the missing
`account.open` below, which names a code and its label alone.

**Lanterne.** Thomas claims his train with its receipt in one write;
Léa attaches hers to her own expense and is refused on Sofia's. Julien
carries October over from the old books: the rental paid from the bank
opens 6135; the fees entry does not balance and is refused, opening
nothing.

## Uncontested writes

| Write | Why nothing contends |
|---|---|
| `circle.message`, `document.comment` | appended; no rule reads them |
| `invoice.send` | idempotent; a send that races a void is followed by the void's credit note |
| `decision.propose` | a fact; the roll and the motions are fixed when the server receives it, and the cutoff by `close` |
| `member.invite` | two invitations do no harm, unless they carry one device key, which is refused |
| `client.add` | duplicates are merged by hand |
| `project.create`, `task.create` | facts; a project's slug taken twice is refused, a task's number is the server's |
| `project:milestone.complete` | idempotent: the first day stands |
| `timesheet:period.submit` | idempotent: the first day stands |
| `document.create`, `meeting.schedule` | facts; a document's slug taken twice is refused, a second meeting of a circle on one day is numbered |
| `meeting.minute` | idempotent: the first day stands, and the minutes are the document already kept |
| `file.upload`, `import:run.record` | facts; a file never changes, and an import's record is its importer's own |

## Missing writes

The matrix found writes no `ops.ts` declares:

| Missing | Label it needs | Why |
|---|---|---|
| granting a share or a series | ordered | bounded writes spend rights nothing grants |
| `account.open` | ordered | account codes are unique in the scope |
| `document.version` | confluent | adoption names versions nothing saves; **applied**, now declared |
| `invoice.draft` | confluent | issue numbers a draft nothing creates |
| erasing a person | ordered | the tombstone must be fixed in the log; **applied**, now `client.erase`, `member.erase` and `.forget` |
| setting a draw limit or a salary | ordered | draws and pay runs spend and read what nothing writes but the seed |
| a deduction for losses from a repayment | ordered | the repaid value is the nominal one less the losses the year's accounts show, which nothing reads |
| opening a period | ordered | the fiscal year's months exist only as the seed made them |
| drafting the work share's terms, or an allocation | confluent | adoption and allocation act on drafts nothing writes but the seed |
| paying out the work share's cash | confluent | what `424` still owes after the shares, which nothing pays |

## Recommended label changes

1. **Applied.** `key.enrol`: confluent → **ordered**. Enrol and revoke do
   not commute; a stolen key can plant a device the revocation misses.
2. **Applied.** `transaction.credit` and `.debit` → **one
   `transaction.post`, confluent**. An entry debits and credits; the
   spending right is `account.draw`'s, so `debit`'s bounded share
   duplicated it.
3. **Applied.** `transaction.adjust`: `ordered({ decide: 'majority' })` →
   **`ordered({ base: 'corrected' })`**. The conflict is two corrections of
   one entry; a decision is the circle's parameter, not the write's type.
4. **Applied.** `invoice.payment` stays confluent; **its invariant
   changes** from a refusal to an overpaid credit, and payments merge by
   bank reference.
5. **Not yet.** `decision.vote` stays confluent; **at rung 2 a stance
   names its parent**, since receipt order is not signing order across a
   member's devices.
6. **Applied.** No other label changes. `circle.nest`'s comment now says
   it is ordered at rung 1 too, and `document.adopt`'s that the base is
   the adopted version, not the draft.
7. **Applied, beyond this page's recommendations.** Positions move from
   `circle` to the `circle-member` graft, which owns the relationship:
   `circle-member:position.add` and `.remove`, both ordered. A mandate's
   cap splits into `limit` (per write) and `budget` (cumulative, over
   `per`).
