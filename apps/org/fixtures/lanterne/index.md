+++
title = "Lanterne"
updated = 2026-11-09
+++

# Lanterne

A mock co-op to build the prototype against: a creative agency in Montreuil,
in the EU, run as a worker co-operative by its ten worker-members since
2021, its members living around the world. Every word a reader sees in it
is English: its titles, descriptions, motions, documents, minutes,
policies, rights, roles and account labels, as is every word the
slices themselves show on it, their labels, notes and refusals, and no
test asserts a French one; its people's names are international. The founding legal form reads “worker co-operative limited company
with variable capital”; its `scop-sarl-fr` identifier, French street addresses,
people's and clients' names, registration numbers, account codes and the
French statutes a figure or a refusal cites by name stay as recorded, not
translated. The fixture's imported sample files use English
headings and labels too, while retaining their source formats and figures.
It builds websites
and online shops, designs brands, print and packaging, and runs marketing for
clients who are mostly co-ops, associations and small local firms. Every
name, number and identifier here is invented.

Lanterne is rich enough to show every feature: each collection and each
of its views holds enough rows, in enough of their states and with
enough relations, that nothing the app can show is empty or trivial on
it; and every circle holds data scoped to it, a distinct and believable
slice, so the circle lens shows each circle its own. The fixture check
asserts both, per collection and per circle: a collection the app
mounts with too few rows, a state or a relation it never holds, or a
circle with no rows scoped to it, fails it, naming the collection or the
circle and what it lacks, so it stays true as features land
(`tools/fixture/rich.mjs`). Which collections the app mounts it reads
from the slices themselves, so one a feature adds fails it until the
check says what of the fixture it lists. Every circle owns rows of each
collection a circle's work fills, its projects, tasks, time, meetings,
motions, documents and expenses, and the invoices and bills spread over
more than one; the people, devices, contacts, files, books and pay are
the co-op's, the assembly's. A collection whose rows are not the
fixture's says why: the inbox is what waits on its reader, the reports
are drawn from the books, the log holds the founding alone, an import's
run is what importing one of the files under `import/` records, and a
worker's statement is what approving the 2025 distribution makes. So
does a lane left empty: no pay run is prepared or approved and not yet
paid, since October's is the payroll scenarios' to generate. The
`lenses` scenario reads the seeded co-op as the app does and holds it to
the check: each board's lanes are the check's, every lane it finds held
shows, and each circle's lens shows rows of its own and none another's.

## People and circles

Every member sits in the general assembly, one member one vote, by a
tenure of its `member` role, whose mandates let every member edit contacts
and documents; and in one working circle, as its member or its lead.
The lead role is a member of coordination, which meets weekly, so each
circle's lead sits there by their tenure, and Camille sits there as a
member. A capped role, as the manager's or a circle's lead, is held by
one person at a time. No circle sits in another: the assembly is one
circle beside coordination and the four working circles.

| Circle | Members | Lead |
|---|---|---|
| Web | Yusuf Demir, Léa Bernard, Thomas Nguyen, Amina Diallo | Yusuf |
| Brand | Camille Martin, Hugo Lefèvre, Sofia Rossi | Hugo |
| Marketing | Malik Benali, Chloé Moreau | Malik |
| Operations | Julien Petit | Julien |

Camille is the manager, by a tenure from 20 June 2024 until 20 June 2028, with a mandate to
sign contracts and commit up to 20 000 €. Julien holds the finance role: he
keeps the books, issues invoices, records suppliers' bills and pays them
up to 3 000 € a payment,
prepares and pays the monthly pay run, which Camille approves, reimburses
expenses up to 3 000 € and closes each month. Leads approve their
members' expenses up to 1 000 € a month each, Camille up to 2 000 € an
expense and suppliers' bills up to 5 000 € a bill, and leads quote up to
15 000 €. Sofia, Brand's print buyer since 12 October, approves Brand's
print and paper bills up to 1 200 € a bill.
Leads and the manager run projects and set their budgets, the leads up to
15 000 € and Camille up to 50 000 €, and approve timesheets, a lead
those of their own circle's members; Julien, seated in the assembly as
treasurer, approves everyone's, as Camille does. Every member creates
and moves tasks; every worker logs their own time and claims their
expenses, by an employee's rights.
Camille hires; a worker employed a year applies to join by their own
right, which opens their candidacy and puts their admission to the
assembly, and no one opens a candidacy for another.

## Where things stand on 24 October 2026

- **People (confluent).** Twelve workers, on permanent contracts of 35
  hours: the ten members, Paul until he left, and Inès Haddad, a junior
  developer hired on 1 September 2025, employed and no member. Everyone
  hired after the founding served a probation of six months to a year as
  a candidate before the assembly admitted them; Inès's ended on 31
  August 2026. She sits in Web since her hire, a seat any person may
  hold, member or not, though only the assembly's asks a membership.
  She signs from the laptop her hire enrolled, logs her own time with
  the web circle, and has not yet marked the internal rules read, which
  every member has.
- **Admission (ordered).** Inès, invited on 30 September, asks to join.
  Seven members have consented to m-2026-012; Hugo objected, then
  consented two days later, and only his latest stance counts. The vote
  closes on 31 October; she took up her invitation on 1 October, on her
  phone.
- **Rate card (confluent, then ordered).** The 2027 rate card has two
  versions. Malik has commented on the second and objected to m-2026-011,
  which would adopt it; the motion is open until 9 November.
- **The working circles' motions (ordered).** Marketing passed
  m-2026-015 on 5 October, publishing its case studies under CC BY;
  Brand's m-2026-016, sending all of its print to one printer, closed
  rejected on 8 October on Sofia's objection; Web's m-2026-017, making
  accessibility the floor of every site, is open until 3 November,
  tabled at its meeting of 20 October.
- **Procedures.** Circles decide by consent. Each procedure is a policy
  of the assembly, adopted by the founding motion, m-2021-001, on 1
  March 2021: consent, majority, two thirds and election, and the
  statutes' two assemblies, the ordinary, a majority of the votes cast
  once a quarter of the associates take part, and the extraordinary,
  which amends the statutes, two thirds of the votes cast once half take
  part (`motion.toml`; Act No. 78-763, as the CG Scop's model statutes
  put it, not checked on Légifrance).
- **Mandates.** Each mandate is a policy, the assembly's, adopted with
  the statutes by m-2021-001, but the four of the bills' chain, below,
  which three later motions adopted, the assembly's, coordination's and
  Operations'. Its sentence marks the role, the power and the cap, as `The {role: finance} role holds {power: pay-supplier}, to
  pay suppliers, up to {limit: 3 000 €} a write`, and its values are
  copied into `circle.mandate` as it is adopted (`motion.toml`). A
  lead's mandates to run projects, approve time and hold meetings, and
  a secretary's, mark their scope, the circle the role is held in
  (`{scope: own}`), so each lead covers their own circle alone; the
  others mark none and cover the whole co-op. The
  collective mandates follow them, `m-2021-001/47` to `/59` but `/50`, each on a
  circle, as `The {circle: ag} circle holds {power: admit-member}, to
  admit members, by motion`: the assembly's to admit, suspend and
  exclude members, adopt and end policies, approve the distribution, adopt documents and
  seat members; coordination's to adopt and end policies, adopt
  documents and seat members. No working circle holds
  one from the founding, so a motion of Web carries no action. The rights follow,
  `m-2021-001/60` to `/71`, each a policy of the kind `right`, no
  mandate, given to the people who hold it as such, with no seat and no
  grantee, as `Every {right: employee} holds {power: claim-expense}, to
  claim their expenses and file their receipts`, and among the first,
  `m-2021-001/10`, `Every {right: employee} holds {power: log-time}, to
  log, correct and submit their own time`, and
  `m-2021-001/74`, `Every {right: person} holds {power:
  withdraw-membership}, to withdraw their own membership`, and
  `m-2021-001/75`, `Every {right: employee}
  holds {power: apply-membership}, to apply to join once they have
  worked a year, which the assembly must rule on`, and in the
  collective mandates' place, `m-2021-001/50`, `Every {right: person}
  holds {power: erase-own-data}, to erase their own personal data once
  they have left`: every person keeps their
  profile and devices, uploads files, takes up an invitation, files
  their records, marks a text read and records an import, a member
  withdraws their own membership, and one who has left erases their
  own data; every member
  draws on their account, spreads what they owe, marks their attendance
  and saves a report; every employee logs their own time, claims
  their expenses and, once employed a year, applies to join. So Inès,
  employed and no member, keeps her profile,
  logs her time and claims an expense by her rights, beside the
  mandates her seat in Web gives her there, and Paul,
  gone since 30 November 2025, holds a person's alone. The rights, and
  the collective mandates that hand out mandates, the assembly's and
  coordination's to adopt and end policies and to seat members
  (`m-2021-001/51`, `/52`, `/55`, `/56`, `/57` and `/59`), are protected
  by the extraordinary assembly's procedure: only a motion decided by it,
  or by a stricter one, replaces or ends them. `m-2021-001/76`, `The
  {circle: ag} circle holds {power: create-circle}, to create a circle,
  by motion`, is how a circle is made, and a circle the assembly creates
  holds Lanterne's default bundle from that day, the mandates on the
  participant, lead and secretary roles. The last three of the founding
  motion, `m-2021-001/77` to `/79`, are how Lanterne reads: `The {role:
  participant} role holds {power: read}, to read the records of its
  {scope: own} circle`, and of the `{scope: ag}` circle, the whole
  co-op's; and open books, `The {role: member} role holds {power: read},
  to read every circle's records`. Every seat reads its own circle's
  records and the assembly's, and every member every circle's, so Inès,
  employed, no member and seated in Web alone, reads Web's expenses and
  the statutes she would join under, and not Marketing's expenses;
  Chloé, in Marketing, reads every circle's expenses and the books, and
  her own pay and not Yusuf's, since `read` opens no one's pay. A power
  that reads a feat's rows reads them by its mandate's scope beside it:
  the manager's `approve-expense`, on the whole co-op, every circle's
  expenses, and Web's lead's `approve-time`, on their own circle, Web's
  time alone.
- **Rules.** The statutes' capital terms and the work share's terms are
  rules of the assembly adopted by m-2021-001, their values named for the
  feat that reads them and copied into its terms as each is adopted:
  `m-2021-001/43`, `Each associate subscribes at least {account_minimum:
  20 | more is stricter} shares`, and `m-2021-001/44`, the work share
  `{patronage_salary: 100 % | more is stricter}` by pay; and the law's
  floors on the surplus, `m-2021-001/72`, at least `{work_share: 25 % |
  more is stricter}` to all the employees, and `/75`, at least
  `{reserve_share: 15 % | more is stricter}` to the reserves, named for no
  feat. Its last, `m-2021-001/80`, is open books' disclosure rule, the
  disclosure study's defaults, copied by core into `circle.disclosure`:
  a total of members' own figures is shared with every member where at
  least `{disclosure_contributors: 5 | more is stricter}` people put into
  it, none more than `{disclosure_largest: 50 % | less is stricter}` and
  no two more than `{disclosure_two: 80 % | less is stricter}`
  ([open books](../../core/circle/index.md#open-books)). The internal
  rules' third version, adopted by m-2026-007 on 20 June 2026, holds five
  rules: the 35-hour week, at most three remote days, the pay ratio of at
  most 1.6, the solidarity rate for associations and co-ops under ten
  staff, each value saying which way is stricter, and the clients refused,
  which bind by their words alone.
- **Legal form.** Lanterne is a worker co-operative limited company with
  variable capital in France (registered as a SCOP SARL), and its founding
  motion, `m-2021-001`, which `scope.toml` names as its `founding`, was
  decided by its founders, the four members since 1 March 2021, each
  seated in the assembly that day and consenting, Paul among them, whose
  seat ended when he left. It takes that form's defaults ([legal forms](../../../../_corpus/doc/forms.md)):
  each policy that is one names it (`takes = "scop-sarl-fr:ordinary"`),
  worded and protected as it reads. They are its six procedures, the
  participant's mandates (`/45`, `/46`), the assembly's collective
  mandates (`/47` to `/56`), its rights (`/10`, `/62` to `/73`, `/76`, `/77`) and the
  floors on the surplus (`/74`, `/75`): 35 policies. Its role mandates,
  coordination's collective mandates and its capital and work share terms
  are its own. It has left none of the defaults, so its statutes say they
  leave none.
- **Statutes (generated).** The statutes are the assembly's policies in
  order, generated around the fixed text of a worker co-operative limited
  company with variable capital (`document.toml`), and after them the
  defaults of that form the assembly left: `statutes@1`, adopted on 1 March 2021 with
  m-2021-001's procedures, mandates and rules, and `statutes@2`, on 20
  June 2026, with the internal rules' five rules m-2026-007 adopted and
  coordination's `approve-bill` m-2026-008 granted that day.
  No one edits them; the next adoption by the assembly generates the next.
- **Working texts (confluent).** Each working circle keeps one of its
  own: Web's accessibility checklist, which embeds its motion on
  accessibility, Brand's print specifications, Marketing's newsletter
  style guide and Operations' month-end close.
- **Invoices (bounded).** Fifteen invoices in the series F-2026, 0041 to
  0055; the next is 0056, each the circle's whose project it bills, Web's,
  Brand's or Marketing's. Clients owe 57 180 €. Compagnie Mauve Horizon's
  posters (0044) are three months overdue, Vélo Solidaire has paid half of
  0051, and 0050 was voided and reissued at the solidarity rate.
- **Books.** Carried over from the previous tool on 1 July; July to September
  are closed, October to December are open. The bank holds 39 190,40 € after
  October's rent, tools and Yusuf's reimbursed train. Each member's capital, their shares at 50 €,
  is in an account of their own; each may draw up to 500 € on it. The
  assembly approved the 2025 split of 61 400 € in June (m-2026-006), as
  Act No. 78-763, article 33 allows: 27 630 € to the members for their work,
  divided by salary, 9 210 € to the legal reserve, 24 111,78 € to the
  development fund and 448,22 € as interest on capital, within the 3,5 %
  of the 13 000 € of capital the statutes pay at most (Act No. 47-1775, article
  14, caps it at 5,36 % for the 2026 assembly); the result was
  carried over undistributed. The 2025 distribution (`patronage.toml`) is
  a draft until its approval cites m-2026-006, which makes each worker's
  part; distributing it, posting it and crediting its shares, is Julien's
  to do as finance. The statutes' patronage terms, a rule, divide the work share by
  pay and employ half of each member's part in shares, blocked five
  years; the rest is paid. Their capital terms, a rule too, value a share at 50 €, ask
  at least 20 of an associate, paid in at most
  10 monthly instalments, and repay one who leaves a year after the exit,
  in three yearly repayments. Paul Garnier, an art director, left on 30
  November 2025: his 30 shares, 1 500 €, are owed him, the first 500 €
  due on 30 November 2026.
- **Pay and expenses.** Ten members are salaried, 26 000 € gross a month
  between them, the highest 1.25 times the lowest, within the internal
  rules' 1.6. July to September's pay runs were carried over, one entry
  each. Inès was paid apart from them by the previous tool; from October
  her 2 200 € is a run's, and October's waits for every worker's October
  to be approved, hers with the members'. Seven October expenses are
  claimed, one for each circle and two for Marketing: three submitted and
  waiting, Thomas's train a draft, Yusuf's train to the federation's
  regional day approved by Camille and reimbursed, Julien's label printer
  approved and owed him, and Chloé's taxi refused by Malik. Two suppliers' bills are recorded and wait
  for Camille's approval: Imprimerie du Parc's paper, 1 440 €, Brand's
  and over Sofia's 1 200 €, and Atelier Lumen's October rent, 1 080 €,
  the assembly's and outside Brand's.
- **Bills, a chain of mandates (ordered).** Who approves a supplier's
  bill below the manager is handed down three mandates deep, each
  narrower than the one above ([circle](../../core/circle/index.md#lanterne)):
  the annual assembly's m-2026-008, on 20 June 2026, grants coordination
  `approve-bill` up to 3 000 € a write; coordination's m-2026-009, on
  28 September, grants Operations, which keeps the suppliers,
  `approve-bill` up to 2 000 € and `adopt-policy`, each under its own;
  and Operations' m-2026-010, on 12 October, decided by Julien, its one
  seat, grants the print buyer, a role made for Brand and held by Sofia
  by a tenure from that day, `approve-bill` up to 1 200 € on Brand's
  bills (`{scope: brand}`). A circle decides about no role of its own,
  so Brand's is Operations' to grant. Two motions wait to be closed,
  each past its deadline of 24 October with consents and no objection:
  coordination's m-2026-013, granting finance `approve-bill` up to
  1 500 € under its own, and the assembly's m-2026-014, ending
  coordination's, whose close revokes Operations' and the print buyer's
  with it the same day. Sofia, on the verdict date, holds no mandate to
  record a bill, approves Imprimerie du Parc's 1 440 € over her limit
  and Atelier Lumen's rent outside her scope, and each is refused
  saying so.
- **Work (confluent, bounded and ordered).** Eleven projects: eight, one per
  commission, each invoice naming its own: the Halles shop launched on 8 October and is in care until
  November, Ferrand's packaging waits on its press check, Terres Vives's
  microsite is under way, Ondine's shop is archived; and three of the
  circles' own, for no client: the assembly's revision of the statutes
  for 2027, coordination's pipeline and staffing for 2027, and the move
  of the books into cella, Operations'. Thirty-seven tasks on the board,
  each its circle's, its project's where it is filed in one, mostly with
  a member of that circle.
  Timesheets began on 1 September: seven hours a working day for everyone,
  under a third billable at 80 € an hour; an hour costs the co-op
  23,64 €. Four members hold shares of project budgets. September is
  approved; October is open, but Sofia submitted hers early. In its last
  week Camille gives part of her time to coordination and the assembly,
  and Julien an hour a day to the assembly's accounts. The report feat watches a project past a 90 %
  burn or under a 20 % margin: Ferrand's packaging and Terres Vives's report
  are.
- **Meetings (confluent, then ordered).** The annual assembly met on 20
  June, all ten members present, approved the 2025 accounts and the
  internal rules, and Julien, its secretary, wrote its minutes, which the
  assembly approves at its next session. Coordination has met every
  Monday since 7 September, Malik its secretary, over the pipeline,
  staffing, the rate card and Inès's admission; it meets next on 26
  October. Camille scheduled the assembly of 31 October, its agenda the
  June minutes, Inès's admission and the rate card. Leads and the
  manager schedule meetings; secretaries and leads hold them and record
  who came; every member marks themselves. The working circles meet on
  their own: Operations on 5 October, Brand on 15 October and Web on 20
  October, each marked by its lead; Marketing's of 22 October was
  cancelled for the Nuvola workshop. Marketing meets next on 29 October,
  Web on 3 November.
- **Files (confluent).** The statutes as adopted in 2024 are the co-op's
  own; Camille's subscription form is on her file, Inès's contract on
  hers, filed by Camille as manager, and Sofia's and Chloé's receipts on
  their October expenses. Julien, as finance, opens the receipts and
  Camille, as manager, the contract.

## The authority walk

The authority model, walked in the running app from one scenario,
`authority-walk` (`apps/org/ts/_e2e/authority-walk.test.ts`). Seed it
and serve it:

```sh
cella db reset
cella seed lanterne --scenario authority-walk
cella serve
```

then sign in on `http://localhost:5173/sign-in` as the person each step
names. The story starts from the bills' chain above, on 24 October,
and leaves the clock on 31 October with four motions open, each past
its deadline with every vote in, for the operator to close:
coordination's m-2026-013 and the assembly's m-2026-014 from the
fixture, and two the story proposes from Brand's page, the print
buyer's grant and change below.

1. **A mandate's chain.** As Sofia, open Brand's page, then the print
   buyer's Approve bill mandate it lists: its Chain reads from the
   assembly's root, coordination's 3 000 €, down through Operations'
   2 000 € to hers, 1 200 € on Brand's bills, each link saying how it
   narrows the one above; each link opens its own page, the root's
   listing what was issued under it.
2. **A person's powers.** As Sofia, her own page's Powers tab: every
   power she holds and by what, Approve bill by her tenure of the print
   buyer, up to 1 200 € over Brand's, each mandate's line opening its
   page; and her rights as a member, an employee and a person.
3. **Each refusal.** Still as Sofia, three writes her mandates do not
   cover, each refused with the mandate missing or exceeded and what
   would fix it: Approve on Imprimerie du Parc's bill, 1 440 €, over
   her 1 200 €, naming her mandate and the motion of Operations that
   would raise its limit; Approve on Atelier Lumen's rent, the
   assembly's, outside her scope, naming what her mandate covers and
   the role that would cover it; and a bill recorded from the Bills
   list's New form, on the assembly's records since the form names no
   circle, which she holds by no mandate, naming finance, which holds
   record-bill, and the tenure that would allow it.
4. **Granting, changing and revoking, by motion.** As Camille, open
   Brand's page: Propose… grants a mandate to one of its roles or to
   the circle, or changes or revokes one of its mandates, saying the
   sentence the policy will read and refusing before anything is
   proposed what no issuer may issue. The story put two from there:
   granting the print buyer `record-bill` over Brand's bills, put to
   the assembly, since no circle holds a mandate to issue it under,
   and raising her `approve-bill` to 1 500 €, put to Operations, which
   issued it, by Julien, its one seat. The print buyer's Approve bill
   mandate's own page offers the same while it stands: Change… opens
   the form filled with its values, Revoke… proposes ending it, each
   put to Operations, which issued it, and saying that it revokes every
   mandate issued under it the same day. Each motion's page says which
   mandate its grant would be issued under or which its end would
   revoke; m-2026-014's lists coordination's and every one under it.
   Close them from their pages, each as a member seated where it is
   put, Camille but for the change, which is Julien's, in this order:
   the grant, the change, m-2026-013, which grants
   finance `approve-bill` up to 1 500 € under coordination's, then
   m-2026-014. Sofia then holds record-bill and approve-bill to
   1 500 €, until m-2026-014's close ends coordination's and revokes
   Operations', the print buyer's as the change made it, and
   finance's with it, the same day; its page lists those four, each
   under the one it ends, and not the print buyer's 1 200 €, which the
   change's own close revoked that day and the change's page lists;
   and Sofia's Approve on the paper bill is refused, naming her
   mandate, the day it was revoked and the motion of Operations that
   would grant it anew.

The scenario's test plays the story, then the steps the seed skips
(`unseeded`): it walks each step in every browser, light and dark, as
the person it names, taking a screenshot at each, into `SHOTS`
(`/tmp/cella-authority-walk-shots` unset), and closes the four motions
in the order above between its two walks, the first before any close
and the second after them all.

## Files

One file per feat and one per graft, so the mock keeps the same boundaries
as the code: an invoice names whom it bills as text, and the link to the
contact record is the `contact-invoice` graft's. Amounts are in cents, and a
mandate is a policy whose power is an id. `tools/fixture-check.mjs` checks
that every entry balances, the surplus split adds up to the surplus, every
link resolves, every billing names a client, and the books agree with the
invoices; `tools/fixture/work.mjs`,
that shares stay within budgets, a project is for a client, an invoice
bills a project of its client,
no one logs more than ten hours a day, time is a worker's on days of
their employment, and an approved month was submitted and approved by
someone else; `tools/fixture/people.mjs`, that a contract runs forward
and names its end where it has one, and that each candidacy's probation
falls within its worker's employment and ended before their admission.

Time is written as runs: one entry a working day from one day to another
(`timesheet.toml`), which the seed expands into the 838 entries of
September and October; which project a run is for is
`graft.project-timesheet.toml`'s.

Meetings and their agendas are `meeting.toml`; who came, the motions
items table, the minutes and each circle's quorum are its grafts' files;
`tools/fixture/meeting.mjs` checks that a held meeting met by the
scope's day and a scheduled one meets after it, that the secretary
recorded only members seated in the circle, others marking themselves as
guests, and that no item tables a motion before it was proposed.

Files are `file.toml`, each one's bytes in `files/` under its name, and
what holds them its grafts' files. `import/` holds a sample of each kind
of file the co-op might bring from the tools it leaves, with lines the
guards refuse beside the ones they take ([the samples](import/index.md));
nothing seeds them.

Pay runs, expenses and bills are `payslip.toml`, `expense.toml` and
`bill.toml`;
`tools/fixture/finance.mjs` checks that each capital account holds its
member's shares at the share's value the founding capital rule gives, or, once they
left, nothing, their repayments adding up to it, due as the statutes
say, and owed in 4567; the work share's terms, read from its rule, divide all of it and govern the
2025 split, which honours art. 33, salaries keep within the
ratio and each carried run's entry is exactly its payslips. Device keys are
TEST-ONLY, derived from each device's address and label when the fixtures
are seeded, so the tests sign with the same keys; anyone can derive them.
The scope's address, `lanterne.example`, is what every write signature
names.
