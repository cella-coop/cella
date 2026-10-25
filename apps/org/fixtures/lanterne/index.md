+++
title = "Lanterne"
updated = 2026-10-25
+++

# Lanterne

A mock co-op to build the prototype against: a creative agency in Montreuil,
run as a SCOP SARL by its ten worker-members since 2021. It builds websites
and online shops, designs brands, print and packaging, and runs marketing for
clients who are mostly co-ops, associations and small local firms. Every
name, number and identifier here is invented.

## People and circles

Every member sits in the general assembly, one member one vote, in its
`member` role, whose mandates let every member edit clients and documents;
and in one working circle. The leads and the manager also sit on
coordination, which meets weekly.

| Circle | Members | Lead |
|---|---|---|
| Web | Yusuf Demir, Léa Bernard, Thomas Nguyen, Amina Diallo | Yusuf |
| Brand | Camille Martin, Hugo Lefèvre, Sofia Rossi | Hugo |
| Marketing | Malik Benali, Chloé Moreau | Malik |
| Operations | Julien Petit | Julien |

Camille is the gérante, elected in June 2024 for four years, with a mandate to
sign contracts and commit up to 20 000 €. Julien holds the finance role: he
keeps the books, issues invoices, pays suppliers up to 3 000 € a payment,
prepares and pays the monthly pay run, which Camille approves, reimburses
expenses up to 3 000 € and closes each month. Leads approve their
members' expenses up to 1 000 € a month each, Camille up to 2 000 € an
expense, and leads quote up to 15 000 €.
Leads and the gérante run projects and set their budgets, the leads up to
15 000 € and Camille up to 50 000 €, and approve timesheets, a lead
those of their own circle's members; Julien, seated in the assembly as
treasurer, approves everyone's, as Camille does. Every member creates
and moves tasks and logs their own time.

## Where things stand on 24 October 2026

- **Admission (ordered).** Inès Haddad, a junior developer employed since
  September 2025, asks to join. Seven members have consented to d-2026-012;
  Hugo objected, then consented two days later, and only his latest stance
  counts. The vote closes on 31 October.
- **Rate card (confluent, then ordered).** The 2027 rate card has two
  versions. Malik has commented on the second and objected to d-2026-011,
  which would adopt it; the decision is open until 9 November.
- **Invoices (bounded).** Fifteen invoices in the series F-2026, 0041 to
  0055; the next is 0056. Clients owe 57 180 €. Compagnie Mauve Horizon's
  posters (0044) are three months overdue, Vélo Solidaire has paid half of
  0051, and 0050 was voided and reissued at the solidarity rate.
- **Books.** Carried over from the previous tool on 1 July; July to September
  are closed, October to December are open. The bank holds 39 296 € after
  October's rent and tools. Each member's capital, their shares at 50 €,
  is in an account of their own; each may draw up to 500 € on it. The
  assembly approved the 2025 split of 61 400 € in June (d-2026-006), as
  loi 78-763, art. 33 allows: 27 630 € to the members for their work,
  divided by salary, 9 210 € to the legal reserve, 15 350 € to the
  development fund and 9 210 € as interest on capital; the result was
  carried over unallocated, and allocating it is Julien's to do. The
  statutes' terms divide the work share by pay and employ half of each
  member's part in shares, blocked five years; the rest is paid.
- **Pay and expenses.** Ten members are salaried, 26 000 € gross a month
  between them, the highest 1.25 times the lowest, within the internal
  rules' 1.6. July to September's pay runs were carried over, one entry
  each; October's waits for every member's October to be approved. Four
  October expenses are claimed, three submitted.
- **Work (confluent, bounded and ordered).** Eight projects, one per
  commission, each invoice naming its own: the Halles shop launched on 8 October and is in care until
  November, Ferrand's packaging waits on its press check, Terres Vives's
  microsite is under way, Ondine's shop is archived. Thirty-three tasks on
  the board, each with a member of the circle that runs its project.
  Timesheets began on 1 September: seven hours a working day for everyone,
  under a third billable at 80 € an hour. Four members hold shares of
  project budgets. September is approved; October is open.
- **Meetings (confluent, then ordered).** The annual assembly met on 20
  June, all ten members present, approved the 2025 accounts and the
  internal rules, and Julien, its secretary, wrote its minutes, which the
  assembly approves at its next session. Coordination has met every
  Monday since 7 September, Malik its secretary, over the pipeline,
  staffing, the rate card and Inès's admission; it meets next on 26
  October. Camille scheduled the assembly of 31 October, its agenda the
  June minutes, Inès's admission and the rate card. Leads and the
  gérante schedule meetings; secretaries and leads hold them and record
  who came; every member marks themselves.

## Files

One file per feat and one per graft, so the mock keeps the same boundaries
as the code: an invoice names whom it bills as text, and the link to the
client record is the `client-invoice` graft's. Amounts are in cents, and a
mandate's power is an id beside its text. `tools/fixture-check.mjs` checks
that every entry balances, the surplus split adds up to the surplus, every
link resolves and the books agree with the invoices; `tools/fixture/work.mjs`,
that shares stay within budgets, an invoice bills a project of its client,
no one logs more than ten hours a day, and an approved month was submitted
and approved by someone else.

Time is written as runs: one entry a working day from one day to another
(`timesheet.toml`), which the seed expands into the 799 entries of
September and October; which project a run is for is
`graft.project-timesheet.toml`'s.

Meetings and their agendas are `meeting.toml`; who came, the decisions
items table, the minutes and each circle's quorum are its grafts' files;
`tools/fixture/meeting.mjs` checks that a held meeting met by the
scope's day and a scheduled one meets after it, that the secretary
recorded only members seated in the circle, others marking themselves as
guests, and that no item tables a decision before it was proposed.

Pay runs and expenses are `payslip.toml` and `expense.toml`;
`tools/fixture/finance.mjs` checks that each capital account holds its
member's shares, the work share's terms divide all of it and govern the
2025 split, which honours art. 33, salaries keep within the
ratio and each carried run's entry is exactly its payslips. Device keys are
TEST-ONLY, derived from each device's address and label when the fixtures
are seeded, so the tests sign with the same keys; anyone can derive them.
The scope's address, `lanterne.example`, is what every write signature
names.
