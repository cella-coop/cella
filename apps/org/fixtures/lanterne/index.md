+++
title = "Lanterne"
updated = 2026-10-24
+++

# Lanterne

A mock co-op to build the prototype against: a creative agency in Montreuil,
run as a SCOP SARL by its ten worker-members since 2021. It builds websites
and online shops, designs brands, print and packaging, and runs marketing for
clients who are mostly co-ops, associations and small local firms. Every
name, number and identifier here is invented.

## People and circles

Every member sits in the general assembly, one member one vote, and in one
working circle. The leads and the manager also sit on coordination, which
meets weekly.

| Circle | Members | Lead |
|---|---|---|
| Web | Yusuf Demir, Léa Bernard, Thomas Nguyen, Amina Diallo | Yusuf |
| Brand | Camille Martin, Hugo Lefèvre, Sofia Rossi | Hugo |
| Marketing | Malik Benali, Chloé Moreau | Malik |
| Operations | Julien Petit | Julien |

Camille is the gérante, elected in June 2024 for four years, with a mandate to
sign contracts and commit up to 20 000 €. Julien holds the finance role: he
keeps the books, issues invoices, pays suppliers up to 3 000 € a payment and
closes each month. Leads
spend up to 1 000 € a month for their circle and quote up to 15 000 €.

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
  are closed, October is open. The bank holds 39 296 € after October's rent
  and tools; October's payroll is due on the 28th. The assembly allocated
  the 2025 surplus of 61 400 € in June (d-2026-006): 27 630 € to the members
  for their work, 24 560 € to the indivisible reserves and 9 210 € as
  interest on capital.

## Files

One file per feat and one per graft, so the mock keeps the same boundaries
as the code: an invoice names whom it bills as text, and the link to the
client record is the `client-invoice` graft's. Amounts are in cents, and a
mandate's power is an id beside its text. `tools/fixture-check.mjs` checks
that every entry balances, the surplus split adds up to the surplus, every
link resolves and the books agree with the invoices.

Payroll is one entry a month until the payslip feat exists. Device keys are
TEST-ONLY, derived from each device's address and label when the fixtures
are seeded, so the tests sign with the same keys; anyone can derive them.
The scope's address, `lanterne.example`, is what every write signature
names.
