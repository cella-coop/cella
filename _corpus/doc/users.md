+++
title = "Users"
updated = 2026-10-25
+++

# Users

Cella serves organisations whose members govern them, and usually own them.
The first target is the **professional-services worker co-op**: ten to
fifty people selling their work, starting with a creative agency like
[Lanterne](../../apps/org/fixtures/lanterne/index.md). Every other segment
comes later, and each takes from the same feats.

## The first target

Worker co-ops in IT, consulting, design, architecture and training, owned
and run by the people who work in them.

| | Typical |
|---|---|
| Headcount | 5–50; the pilot is 5–10 |
| Members | 70–85 % of the workers |
| Revenue | 0.5–5 M€ a year |
| Legal forms | SCOP (France), cooperativa di lavoro (Italy), CTA (Spain), worker co-op (UK) |
| Where | Italy, Spain and France hold most of Europe's worker co-ops; France has about 2 700 SCOPs |

**Governance.** One member, one vote, whatever their seniority or
capital. A general assembly at least yearly approves the accounts, admits
members and splits the surplus. An elected manager (the gérant of a SCOP
SARL) represents the co-op; working circles run day to day, often with a
coordination circle above them. Any member may propose.

**Money.** The surplus is split as the law and statutes require: a share
to the members for their work, a share to indivisible reserves, and
interest on capital. Each member holds capital shares, repaid when they
leave, often over years. Pay usually follows a grid with a cap on the
ratio between the highest and lowest salary.

**Cycles.** Member: hired, a probation of six to twelve months, admitted
by the assembly with a capital subscription, then exit with the capital
repaid. Governance: proposal, discussion, vote, a record that cannot be
rewritten. Money: monthly close, quarterly review, year-end accounts and
surplus split, then the assembly.

### Pain

| Pain | Severity | Cella's answer |
|---|---|---|
| Five to eight disconnected tools; the same data typed twice | critical | one ERP: books, invoices, decisions and members in one scope |
| Year-end surplus split in a spreadsheet, opaque to members | critical | `patronage`, a feat of its own: each year's distribution, its split checked against the law and approved by signed vote, the work share divided by the statutes' terms in that write, then distributed by finance into the books and the associates' capital; a statement for each worker and the year's return to the federation |
| Capital accounts no accounting tool models | critical | capital as accounts, balances from the journal; a subscription paid in at once or in instalments from pay, what is left to pay on 1012, and a departed associate's capital repaid on the statutes' schedule |
| Decisions scattered across email, chat and forms | high | `decision`, with outcomes folded from signed votes |
| No live view of margins; overruns found late | high | each project's margin, live: invoiced less its time's cost and its expenses, its budget burn and forecasts at completion, and the projects to watch past the co-op's thresholds |
| Time tracking resented, yet patronage depends on it | medium | `timesheet`, entry by entry; a weekly grid is not built |
| New members do not understand what they own | medium | a member's page among the people: what joining asks, step by step, each kept by the slice that knows it, and what they own and decide, read back as sentences from the statutes' terms, their seats and their mandates |
| Workers who are not members, and the probation before admission | medium | one `person` for everyone, with `membership` and `employment` nested in it: every worker's contract, member or not, so their time and pay rest on their employment, and a worker invited to join is the same person, their roles chips on the People collection; a candidacy's probation and pledge, and the admission proposed from it once the probation ends |

### People

| Person | At Lanterne | Needs |
|---|---|---|
| Manager | Camille, gérante | a dashboard of the co-op, the assembly's agenda and records, contracts within her mandate |
| Finance | Julien | invoices, payments, the monthly close, the surplus split by the statutes, capital accounts |
| Circle lead | Yusuf, Hugo, Malik | the circle's budget and quotes, staffing, margins |
| Worker-member | Léa, Thomas, Sofia, Amina, Chloé | simple time entry, voting, their own capital account in plain words |
| Candidate | Inès | how to join, what she subscribes, what it means |

Today such a co-op runs Notion or Asana for projects, Toggl for time,
Pennylane, QuickBooks or an accountant for the books, and Loomio or a form
for votes: none of them co-op-aware.

### Not yet answered

What the first target needs that the org app does not do yet, by severity:

- **Critical:** the work share's cash paid. A co-op brings what it had
  from the tools it leaves, each record through the signed write it would
  take by hand, tried first in a dry run: members, clients, projects and
  tasks (Asana's export among them) from CSV, its books from the FEC, its
  invoices to issue, and each worker's own time from Toggl or Harvest;
  Notion's exports, whose columns are each database's own, and carrying
  over open invoices with their old numbers are not built. The patronage
  cycle runs end to end: the terms the statutes adopt, the split between
  shares and cash, a statement per worker and the year's return to the
  federation, whose required figures are not yet
  checked against its forms. Capital is paid in and out by the statutes'
  clauses: a subscription called whole on admission and paid from the bank
  or in instalments withheld from pay, and a departing associate's capital
  repaid in yearly instalments within five years; a deduction for losses
  on repayment is not built.
- **High:** the income statement and the balance sheet are drawn from
  the journal in the PCG's presentation by month, quarter and year, and
  each project's margin is live with its burn, its forecasts and a watch;
  the watch reaches no inbox yet. A proposal is deliberated: its circle's
  members post messages, replies, mentions of members and links to
  documents while it is open; amending a proposal before stances open is
  not built.
- **Medium:** buy-in and buyout formulas. Time is entered a week at a
  time, a project to a row and a day to a column, keyboard first. Workers
  who are not members hold a contract, log their own time by it and are
  paid in the runs; a candidate serves a probation, and the admission is
  proposed from it once it ends; a new member's page lists what joining
  asks and reads back what they own and decide. Ending or changing a
  contract and setting a salary from the shell are not built; a worker
  who is no member books time to a project by their employment.
- **Across personas:** files are kept in the scope's database, named by
  their BLAKE3: an expense's receipts, a worker's employment records, a
  member's records and the co-op's own papers, each opened by whom it
  concerns, who uploaded it and whoever holds a power over what it
  records; files in documents are not built. Each member's inbox gathers
  what waits on them, counted in the sidebar; the home is a dashboard of
  widgets pinned from many collections; a decision is taken by a
  procedure, consent, a majority, two thirds or the co-op's own share of
  the votes cast, with a quorum, chosen per circle and per decision.

## The full profiles

The customer profiles, carried verbatim from seedling (where "Seedling"
and its module names stand for cella and its feats), grouped by sector and
size: [index](users/00-index.md) · [small private](users/01-small-private.md)
· [medium private](users/02-medium-private.md) · [large
private](users/03-large-private.md) · [small civil](users/04-small-civil.md)
· [medium civil](users/05-medium-civil.md) · [large
civil](users/06-large-civil.md) · [small government](users/07-small-gov.md)
· [medium government](users/08-medium-gov.md) · [large
government](users/09-large-gov.md).

## The other segments

| Segment | Size | Takes first | Differs by |
|---|---|---|---|
| Professional partnerships (law, audit, medicine) | 2–50 partners | `account`, `decision` | profit formulas with many factors; votes weighted by equity |
| Producer and freelancer co-ops | 5–50 producers | `invoice`, `account` | patronage by volume traded; members are busy, governance light |
| Freelancers | 1 | `invoice`, `client` | not member-governed; the on-ramp to forming a co-op |
| Industrial worker co-ops | 50–250 | `account`, `decision` | shifts, safety, delegated governance |
| Multi-stakeholder co-ops (SCIC) | 50–250 | `circle`, `decision` | colleges with weighted votes and their own patronage basis |
| Agricultural co-ops | 50–250 | `account`, `invoice` | pool pricing, seasons, revolving capital |
| Consumer co-ops | 500+ | `member`, `decision` | mass membership, delegate assemblies |
| Collectives, housing co-ops, mutual aid | 3–50 | `decision`, `document` | consensus, often no legal entity, shared property |
| Parties, unions, professional bodies | 50–250 | `member`, `decision` | branches, delegates, dues, congresses |
| Federations and large associations | 250+ | `member`, `circle` | members are organisations; joint scopes at rung 5 |
| Councils, citizen assemblies, participatory budgets | 5–250 | `decision`, `document` | public records, sortition, roll-call votes |

Large parliaments are out of scope.
