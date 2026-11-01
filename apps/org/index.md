+++
title = "Org"
updated = 2026-11-01
+++

The cooperative workspace, for member-governed organisations. One deployment
serves one scope: a co-op, a joint circle of co-ops, or a federation.

- `core/` is what every feat inherits, one library each: `actions` (action
  labels, permissions, outcomes), `crypto`, `log`, `keystore`, `guards` (the pure
  guard primitives), `notary` (the `cella` Postgres extension over them),
  `db` (a write's transaction and a slice's server side), `sign` (a
  device's signature on a write), `analytics` (the port reports are read
  through, [its doc](core/analytics/index.md)) and `ui` (the shell's
  tokens and components, [its doc](core/ui/index.md)).
- `feats/` holds one domain each; none imports another.
- `grafts/` joins feats, through their cores.
- `rs/` is `cella`, the CLI that runs every development and production
  task ([its doc](rs/index.md)).
- `ts/` is the shell, the SvelteKit 3 app that mounts every slice.
- The analytics shell, a DuckDB 2.0 server that `cella analytics` runs
  beside Postgres, reads the views the slices publish for every report
  ([architecture](../../_corpus/doc/architecture.md#the-analytics-shell)).

## The shell

`cella serve` shows Lanterne from the dev database. The sidebar's head
is Home, the co-op's dashboard of widgets pinned from its collections
and its reports, the cash, what clients owe, the projects' margins, the motions open
and the meetings ahead until a viewer pins their own, and the Inbox,
what waits on the acting person, its count beside it. Each feat's
collection is a page in the sidebar: People, Circles, Motions, Documents
and Meetings (governance); Clients, Projects, Tasks and Timesheets (work);
Invoices, Accounts, Periods, Allocations, Terms, Statements, Reports,
Transactions, Expenses and Payslips (finance);
Devices, Files, Imports and the Log (platform).
Every collection is the same component, its drawer's View card holding the filter, the
layout (list, table, gallery, board, calendar or dashboard) and its
options, and every item the same detail view, its
drawer's cards filled by the feat and the grafts that join it.
Ctrl-K jumps to any collection or item.

What it writes, as the member picked in the user menu (dev only), each
showing its outcome, Settled with its log entry or Refused with the
guard's reason:

- an invitation carrying the invitee's first device; a new motion, by
  its circle's procedure or another, consent, a majority, two thirds or
  one of the co-op's own with its quorum, with what it decides: admitting, suspending or
  letting go a member, seating or unseating one, nesting a circle,
  granting or revoking a mandate, proposed from the New form or from a
  member's or a circle's page;
- a stance on an open motion, and closing it, which in the same verdict
  admits and seats the members a passing motion admits and enrols the
  devices their invitations carried, then carries out what else it
  decides; a message on an open motion's discussion, perhaps a reply,
  mentioning members and linking documents;
- an edit of a document's draft in the block editor, live: each member's
  edits go as Loro updates through the `edit` write and reach everyone
  with the document open as they settle; saving a version, which the
  database names by its canonical hash; a comment; a new document;
- a meeting of a circle, scheduled by a power that reaches it; its
  agenda drawn up by the circle's members, its items dragged into order,
  a motion tabled; members marking themselves present, excused or
  absent and the secretary recording those seated; held or cancelled
  (ordered), the hold fixing the agenda and who came; its minutes begun
  as a document opening on the meeting's card and agenda, then written
  in the block editor;
- a new invoice, numbered by the server and posted to the books; a
  payment, posted; a void, its credit note posted; marking it sent;
  linking it to a client;
- a member's own name, a client's note, closing a month;
- a project, its milestones, its budget (ordered), its client and the
  shares of its budget (bounded); a task, given to someone, filed under a
  project and moved across the board, a drop between columns being the
  move; time logged as the acting worker by their employment, member or
  not, a week at a time in the grid behind the timesheets' New button,
  booked to a project or the co-op's own, a month submitted by its
  worker and approved by someone else (ordered), which closes it to new
  entries;
- a hire with the worker's first device, enrolled at once; a worker's
  candidacy, the probation before the assembly may admit them and the
  shares they pledge; once it is over, their admission proposed from the
  form it fills in; a member marking the co-op's adopted texts read;
- an expense claimed as the acting member, submitted, approved within the
  approver's limit and monthly budget or refused, and reimbursed, each a
  drop between the board's columns, approval and reimbursement posted;
  filing one under the project it is billed on to;
- a month's pay run prepared from every worker's approved time, member
  or not, approved and paid, each posted; a member's draw on their own
  account, within their limit; a year's distribution approved, citing the
  motion that approved its split, its work share divided among the
  workers as the year's terms say in the same write, then distributed by
  finance, posted and half of each associate's part employed in shares;
  the statutes' patronage and capital terms adopted, each citing the
  motion that moved them;
  money an associate pays in on their subscription, recorded from the
  bank; their subscription spread over monthly instalments from their
  pay, on their own page, each withheld when a run is paid; and a
  departed associate's next repayment paid from the bank, once it falls
  due;
- an expense claimed with its receipt, or a receipt attached to one
  later; a worker's employment record filed by whoever hires, a member's
  own record, and a paper of the co-op's own uploaded, each opening at
  `/files/<id>/content` to whom it concerns, who uploaded it and whoever
  holds a power over what it records;
- a file from another tool imported, or tried in a dry run first, from
  the Imports page: members with their first devices, clients, the books
  from the FEC, invoices to issue, a worker's own time from Toggl or
  Harvest, projects and tasks, each line the write it would be by hand.
At rung 1 an ordered write settles or is refused at once, so Pending is
never shown, though the shell handles it. How slices mount is in
[architecture](../../_corpus/doc/architecture.md#the-shell).

## Feats

Org's feats sit under `feats/`; `person` holds two of its own, `membership`
and `employment`, under `person/feats/`, which inherit its core: a person
is a member if they hold a membership and a worker if they hold an
employment, and the grafts that join a person's role name the child.

| Feat | Group | Rung | What |
|---|---|---|---|
| `person` | governance | 1 | everyone the co-op knows, by the address they sign with, and their devices; its feats below |
| `person/membership` | governance | 1 | a person's membership, invited to exited |
| `person/employment` | work | 1 | a person's employment, member or not, and their contract |
| `circle` | governance | 1 | nested units, seats, roles and mandates |
| `motion` | governance | 1 | proposals, votes, computed outcomes |
| `document` | governance | 1 | drafts, versions and adoption |
| `account` | finance | 1 | the chart of accounts, capital accounts, reserves and funds, their periods and balances, the statutes' capital terms, the statements' rubrics and the spans they are drawn for |
| `patronage` | finance | 1 | the work share's terms, each year's distribution of its surplus, from draft to approved to distributed, and each worker's part and statement |
| `transaction` | finance | 1 | the journal's balanced entries |
| `invoice` | finance | 1 | issue, send, get paid |
| `client` | work | 1 | contacts and companies |
| `project` | work | 1 | initiatives, their milestones and budgets |
| `task` | work | 1 | assignable work |
| `timesheet` | work | 1 | time entries and members' months |
| `expense` | finance | 1 | capture, approve within a budget, reimburse |
| `payslip` | finance | 1 | salaries, monthly pay runs and payslips |
| `report` | finance | 1 | saved reports read through the analytics port: the financial statements, the project margins, the federation figures and a member's own |
| `meeting` | governance | 1 | circles' meetings, their agendas, held or cancelled |
| `file` | platform | 1 | the files the co-op keeps, named by their BLAKE3 |
| `import` | platform | 1 | files brought in from other tools, and what each line came to |
| `person/contact` | governance | later | someone the co-op deals with who is neither a member nor a worker |
| `person/agent` | platform | later | agents acting for members, with narrower grants |

Seedling's co-op economics that rung 1 still leaves out: a work share
divided by revenue, which French law does not offer a SCOP; paying out
the work share's cash; a deduction for losses from a departed associate's
repayment, revolving capital and dues in `account`; quotes with
`project`.

Rung 1's pilot runs one write of each kind end to end: edit a document
(confluent), issue an invoice (bounded, numbered by the server until rung 2),
and admit a member by vote (ordered).

## Grafts

| Graft | What it joins |
|---|---|
| `account-motion` | the capital terms and the motion that adopts them |
| `account-membership-patronage-transaction` | the shares the work share buys, credited to the associates' capital when a distribution posts; what each part became; a year's return to the federation |
| `account-membership-patronage` | each worker's part of the work share split between shares and cash; whose a statement is; the work share's terms read back on a person's page |
| `account-membership-payslip-transaction` | a subscription paid in monthly instalments withheld from pay, posted in the run's payment |
| `account-membership-transaction` | a member's subscription called on admission and paid in, their draws, and a departing associate's capital owed and repaid, posted |
| `account-membership` | who holds each capital account, the share's value from the statutes' terms, draw limits and the freeze on exit; the capital joining asks, and what a member owns, read back from the terms |
| `account-patronage` | a year's split approved only once its books are closed |
| `account-transaction` | a transaction's lines post to accounts, never into a closed period; the income statement and the balance sheet; the books carried over from a FEC |
| `circle-membership-motion` | a motion's roll, who was seated in its circle when it was proposed, whether it passes on it, and what a passing one does to members and seats |
| `circle-motion` | nesting circles and granting and revoking mandates by motion |
| `circle-expense-membership` | a mandate's budget, spent by the expenses its holder approves; the expenses waiting on a member's approval or reimbursement |
| `circle-file-membership` | who opens a personal file by a power over what it records |
| `circle-meeting-membership` | who is expected at a meeting, its quorum, who may draw up its agenda, schedule, hold and record it |
| `circle-meeting` | a meeting's circle, and how a circle meets: its quorum, and whether its minutes are adopted |
| `circle-membership-payslip` | the pay runs waiting on a member to approve or pay them |
| `circle-membership-project` | a lead runs their own circle's projects |
| `circle-membership-timesheet` | a lead approves their own circle's time; the months waiting on a member's approval |
| `circle-membership` | seats: who holds which role in which circle, and how far a power reaches; the circles joining asks, and what a member decides, read back from their seats |
| `client-invoice` | who an invoice bills |
| `client-project` | whom a project is for |
| `document-motion` | adoption of a document version by a motion |
| `employment-membership-motion` | a candidate's admission, proposed from their candidacy once their probation is over |
| `meeting-motion` | the motions a meeting's agenda tables, and where each stands |
| `membership-motion` | admission, suspension and exit by a motion |
| `motion-patronage` | a year's distribution and the motion that approves its split; the work share's terms and the motion that adopts them |
| `document-meeting` | a meeting's minutes, written as a document |
| `document-membership` | who has read the co-op's adopted texts |
| `employment-file` | a worker's employment records, filed by whoever hires |
| `employment-payslip` | whose a salary and a payslip are: a worker's, member or not |
| `employment-project-timesheet` | a worker's time booked to a project by their employment, and the week they enter it in |
| `employment-timesheet` | whose time an entry is, a worker's within their employment, and logging it by that employment |
| `expense-file` | an expense's receipts, one carried by its claim |
| `expense-invoice-project-timesheet` | retired: a project's margin is a report; its migrations stay until launch, the second dropping what the first made |
| `expense-membership` | whose an expense is |
| `expense-project` | the project an expense is billed on to |
| `expense-transaction` | an expense's approval and reimbursement post transactions |
| `file-membership` | a member's records on their own file |
| `invoice-project` | which project an invoice bills, and what each project invoiced |
| `invoice-transaction` | an invoice, its payments and its void post transactions |
| `meeting-membership` | who came to a meeting: present, excused or absent |
| `membership-project` | shares of a project's budget, never beyond it |
| `membership-task` | who does a task |
| `membership-timesheet` | no time of a member suspended or gone, and a member's months |
| `patronage-payslip` | a surplus's work share divided by pay and in equal parts |
| `patronage-timesheet` | a surplus's work share divided by time worked |
| `patronage-transaction` | a year's split posted from its result, the legal reserve's floor |
| `payslip-timesheet` | a pay run from approved time |
| `payslip-transaction` | a pay run's approval and payment post transactions |
| `project-task` | which project and milestone a task is in |
| `project-timesheet` | time against a project, what it spent of the budget and cost the co-op, and its spend at completion |

At `person`, joining its own feats, the lowest node that holds both:

| Graft | What it joins |
|---|---|
| `employment-membership` | a worker's candidacy and probation, and each person's path from hired to member |
