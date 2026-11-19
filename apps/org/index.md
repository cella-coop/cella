+++
title = "Org"
updated = 2026-11-19
+++

The cooperative workspace, for member-governed organisations. One deployment
serves one scope: a coop, a joint circle of coops, or a federation.

Org is an app, the root node of a tree built by the six axioms of
[architecture](../../_corpus/doc/architecture.md#the-axioms): a node is
a core, which cannot be removed, the feats on it and the grafts that
own the relationships between them. Every slice, a feat or a graft,
owns its schema; a slice depends only on the cores of its lineage, and
a graft on the feats it joins and the lower-order grafts at or below
its node; every write is a command the notary logs, with a power and
a fold; and other slices use only a slice's contract, while only
shells import its app. Its tree today:

- `core/` is org's core, never removed. Its **libs** hold shared code
  and no data: `actions` (the commands' labels, permissions and
  outcomes, by the code's name), `body` (a record's blocks and the block
  editor), `crypto`, `log`, `keystore`, `guards` (the pure guard
  primitives), `db` (a command's transaction and a slice's server side),
  `sign` (a device's signature on a command), `vat`, `pdf` and `ui`
  (the shell's tokens and components, [its doc](core/ui/index.md)).
  `notary` is the layer under every slice, the `cella` Postgres
  extension over them. Its **core feats** each own a schema: `circle`,
  `person`, `policy` and `analytics` (the port reports are read
  through, [its doc](core/analytics/index.md)); no core feat uses
  another, and the **core grafts** in `core/grafts/`, `circle-person`
  and `circle-policy`, join those that meet.
- `feats/` holds the feats on org's node, one domain each; none imports
  another, and each can be removed with its subtree and the grafts that
  join it.
- `grafts/` holds the grafts joining them, each in the lowest node that
  holds all its feats.
- `rs/` is `cella`, the CLI that runs every development and production
  task ([its doc](rs/index.md)).
- `ts/` is the web shell, the SvelteKit 3 app that mounts every slice
  and serves its calls.
- The analytics shell, a DuckDB 2.0 server that `cella analytics` runs
  beside Postgres, reads the views the slices publish for every report
  ([architecture](../../_corpus/doc/architecture.md#the-analytics-shell)).

That tree is today's. The axioms' target, which [the target
tree](../../_corpus/doc/architecture.md#the-target-tree) maps path by
path, lays core out as a node, `core/libs/`, `core/feats/` and
`core/grafts/`; a leaf feat's folders as its layers; and the shells
under `shells/`, `ts/` as `shells/web/`, `rs/` as `shells/cli/` and the
analytics shell as `shells/analytics/`.

## The shell

`cella serve` shows Lanterne from the dev database. The sidebar's head
is the Inbox, what waits on the acting person, its count beside it,
where `/` lands, and Activity, the log. Each feat's collection is a page
in the sidebar where the circle the member is in enabled its feature,
under the circle's accordions ([features](core/circle/index.md#features));
the platform's are Settings', the member's Devices
under Personal and the coop's Imports under Organization, and Files is
reached by the command menu ([the shell](core/ui/index.md#components)).
Every collection is the same component: a filter bar on the line under
its header, above its rows, chips of its conditions and its search on
the left, + Filter and Search on the right (folded into the header
instead while no chip holds), and its drawer's View panel of one shape
holding the layout (list, table, gallery, board, calendar or
dashboard), Group by, Order by and Display; and every item the same
detail view, its drawer's cards filled by the feat and the grafts that
join it.
Ctrl-K jumps to any collection or item.

What it writes, as the member picked in the user menu (dev only), each
showing its outcome, Settled with its log entry or Refused with the
guard's reason:

- an invitation carrying the invitee's first device; a new motion, by
  its circle's procedure or another, consent, a majority, two thirds or
  one of the coop's own with its quorum, with what it decides: admitting, suspending or
  letting go a member, seating or unseating one,
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
  linking it to a contact;
- a member's own name, a contact's notes in its body, closing a month;
- a project, its milestones, its budget (ordered), its contact and the
  shares of its budget (bounded); a task, given to someone, filed under a
  project and moved across the board, a drop between columns being the
  move; time logged as the acting worker by their employment, member or
  not, a week at a time in the grid behind the timesheets' New button,
  booked to a project or the coop's own, a month submitted by its
  worker and approved by someone else (ordered), which closes it to new
  entries;
- a hire with the worker's first device, enrolled at once; an
  employee's application to join by right after a year, which puts their
  admission to the assembly and opens their candidacy, the probation they
  served and the shares they pledge; for a candidate invited by a member,
  their admission proposed from the form their candidacy fills in once
  it is over; a member marking the coop's adopted texts read;
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
  own record, and a paper of the coop's own uploaded, each opening at
  `/files/<id>/content` to whom it concerns, who uploaded it and whoever
  holds a power over what it records;
- a file from another tool imported, or tried in a dry run first, from
  the Imports page: members with their first devices, contacts, the books
  from the FEC, invoices to issue, a worker's own time from Toggl or
  Harvest, projects and tasks, each line the write it would be by hand.
At rung 1 an ordered write settles or is refused at once, so Pending is
never shown, though the shell handles it. How slices mount is in
[architecture](../../_corpus/doc/architecture.md#the-shell).

## Feats

Circles, roles, tenures and mandates are core, as groups are in standard
RBAC: `core/circle`, which every feat builds on, holds the circles, their
roles, the seats read from their members and the tenures of each role,
and the mandates and rights, and their page in the sidebar
([circle](core/circle/index.md)).

People are core too: `core/person` holds everyone the coop knows, by
the address they sign with, their devices and the keyring, the rights
registry, and the Inbox, what waits on the acting person
([person](core/person/index.md)). Every feat's rows may name a core
person, as they name a circle.

Org's feats sit under `feats/`, every one top-level: a person is a
member if they hold a membership and a worker if they hold an
employment, each a feat whose rows name a core person, and the grafts
that join a person's role name the feat.

| Feat | Group | Rung | What |
|---|---|---|---|
| `membership` | governance | 1 | a person's membership, invited to exited; whether a seat counts, and so who may use a power |
| `employment` | work | 1 | a person's employment, member or not, and their contract |
| `motion` | governance | 1 | proposals, votes, computed outcomes; mandates granted and revoked by motion, and whom a circle's motion decides about |
| `document` | governance | 1 | drafts, versions and adoption |
| `account` | finance | 1 | the chart of accounts, capital accounts, reserves and funds, their periods and balances, the statutes' capital terms, the statements' rubrics and the spans they are drawn for |
| `patronage` | finance | 1 | the work share's terms, each year's distribution of its surplus, from draft to approved to distributed, and each worker's part and statement |
| `transaction` | finance | 1 | the journal's balanced entries |
| `invoice` | finance | 1 | issue, send, get paid |
| `contact` | work | 1 | the organisations and people the coop deals with |
| `project` | work | 1 | initiatives, their milestones and budgets |
| `task` | work | 1 | assignable work |
| `timesheet` | work | 1 | time entries and members' months |
| `expense` | finance | 1 | capture, approve within a budget, reimburse |
| `payslip` | finance | 1 | salaries, monthly pay runs and payslips |
| `report` | finance | 1 | saved reports read through the analytics port: the financial statements, the project margins, the federation figures and a member's own |
| `meeting` | governance | 1 | circles' meetings, their agendas, held or cancelled; how a circle meets |
| `file` | platform | 1 | the files the coop keeps, named by their BLAKE3 |
| `import` | platform | 1 | files brought in from other tools, and what each line came to |
| `agent` | platform | later | agents acting for members, with narrower grants |

Seedling's coop economics that rung 1 still leaves out: a work share
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
| `membership-motion` | a motion's roll, who was seated in its circle when it was proposed as its procedure says, and who may veto it, whether it passes on it, and what a passing one does to members and seats; admission, suspension and exclusion by a motion |
| `expense-membership` | a mandate's budget, spent by the expenses its holder approves; the expenses waiting on a member's approval or reimbursement; whose an expense is |
| `file-membership` | who opens a personal file by a power over what it records; a member's records on their own file |
| `meeting-membership` | who is expected at a meeting, its quorum, who may draw up its agenda, schedule, hold and record it; who came to a meeting: present, excused or absent |
| `membership-payslip` | the pay runs waiting on a member to approve or pay them |
| `membership-project` | a lead runs their own circle's projects; shares of a project's budget, never beyond it |
| `membership-timesheet` | a lead approves their own circle's time; the months waiting on a member's approval; no time of a member suspended or gone, and a member's months |
| `contact-invoice` | who an invoice bills |
| `contact-project` | whom a project is for |
| `document-motion` | adoption of a document version by a motion |
| `employment-membership-motion` | a candidate's admission, proposed from their candidacy once their probation is over |
| `meeting-motion` | the motions a meeting's agenda tables, and where each stands |
| `motion-patronage` | a year's distribution and the motion that approves its split; the work share's terms and the motion that adopts them |
| `document-meeting` | a meeting's minutes, written as a document |
| `document-membership` | who has read the coop's adopted texts |
| `employment-file` | a worker's employment records, filed by whoever hires |
| `employment-membership` | a worker's candidacy and probation, and each person's path from hired to member |
| `employment-payslip` | whose a salary and a payslip are: a worker's, member or not |
| `employment-project-timesheet` | a worker's time booked to a project by their employment, and the week they enter it in |
| `employment-timesheet` | whose time an entry is, a worker's within their employment, and logging it by that employment |
| `expense-file` | an expense's receipts, one carried by its claim |
| `expense-invoice-project-timesheet` | retired: a project's margin is a report; its migrations stay until launch, the second dropping what the first made |
| `expense-project` | the project an expense is billed on to |
| `expense-transaction` | an expense's approval and reimbursement post transactions |
| `invoice-project` | which project an invoice bills, and what each project invoiced |
| `invoice-transaction` | an invoice, its payments and its void post transactions |
| `membership-task` | who does a task |
| `patronage-payslip` | a surplus's work share divided by pay and in equal parts |
| `patronage-timesheet` | a surplus's work share divided by time worked |
| `patronage-transaction` | a year's split posted from its result, the legal reserve's floor |
| `payslip-timesheet` | a pay run from approved time |
| `payslip-transaction` | a pay run's approval and payment post transactions |
| `project-task` | which project and milestone a task is in |
| `project-timesheet` | time against a project, what it spent of the budget and cost the coop, and its spend at completion |

