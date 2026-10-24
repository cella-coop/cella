+++
title = "Org"
updated = 2026-10-24
+++

The co-op ERP, for member-governed organisations. One deployment serves one
scope: a co-op, a joint circle of co-ops, or a federation.

- `core/` is what every feat inherits, one library each: `ops` (write labels,
  permissions, outcomes), `crypto`, `log`, `keystore`, `rules` (the pure
  rule primitives), `notary` (the `cella` Postgres extension over them),
  `db` (a write's transaction and a slice's server side), `sign` (a
  device's signature on a write) and `ui` (the shell's tokens and
  components, [its doc](core/ui/index.md)).
- `feats/` holds one domain each; none imports another.
- `grafts/` joins feats, through their cores.
- `rs/` is `cella`, the CLI that runs every development and production
  task ([its doc](rs/index.md)).
- `ts/` is the shell, the SvelteKit 3 app that mounts every slice.

## The shell

`cella serve` shows Lanterne from the dev database. Each feat's collection
is a page in the sidebar: Members, Circles, Decisions and Documents
(governance); Clients, Projects, Tasks and Timesheets (work); Invoices,
Accounts, Periods, Allocations, Transactions, Expenses and Payslips
(finance); Devices and the Log
(platform). Every collection is the same
component, its drawer's View card holding the filter, the list or table
layout and the table's columns, and every item the same detail view, its
drawer's cards filled by the feat and the grafts that join it.
Ctrl-K jumps to any collection or item.

What it writes, as the member picked in the user menu (dev only), each
showing its outcome, Settled with its log entry or Refused with the
rule's reason:

- an invitation carrying the invitee's first device; a new decision, by
  its circle's procedure, with what it decides: admitting, suspending or
  letting go a member, seating or unseating one, nesting a circle,
  granting or revoking a mandate, proposed from the New form or from a
  member's or a circle's page;
- a stance on an open decision, and closing it, which in the same verdict
  admits and seats the members a passing decision admits and enrols the
  devices their invitations carried, then carries out what else it
  decides;
- an edit of a document's draft in the block editor, live: each member's
  edits go as Loro updates through the `edit` write and reach everyone
  with the document open as they settle; saving a version, which the
  database names by its canonical hash; a comment;
- a new invoice, numbered by the server and posted to the books; a
  payment, posted; a void, its credit note posted; marking it sent;
  linking it to a client;
- a member's own name, a client's note, closing a month;
- a project, its milestones, its budget (ordered), its client and the
  shares of its budget (bounded); a task, given to someone, filed under a
  project and moved across the board, a drop between columns being the
  move; time logged as the acting member, alone or against a project, a
  month submitted by its member and approved by someone else (ordered),
  which closes it to new entries;
- an expense claimed as the acting member, submitted, approved within the
  approver's limit and monthly budget or refused, and reimbursed, each a
  drop between the board's columns, approval and reimbursement posted;
  filing one under the project it is billed on to;
- a month's pay run prepared from approved time, approved and paid, each
  posted; a member's draw on their own account, within their limit; a
  year's surplus allocated, citing the decision that approved its split.

At rung 1 an ordered write settles or is refused at once, so Pending is
never shown, though the shell handles it. How slices mount is in
[architecture](../../_corpus/doc/architecture.md#the-shell).

## Feats

| Feat | Group | Rung | What |
|---|---|---|---|
| `key` | platform | 1 | members' devices and their keys |
| `member` | governance | 1 | a person's membership, invited to exited |
| `circle` | governance | 1 | nested units, positions, roles and mandates |
| `decision` | governance | 1 | proposals, votes, computed outcomes |
| `document` | governance | 1 | drafts, versions and adoption |
| `account` | finance | 1 | the chart of accounts, capital accounts, reserves and funds, their periods and balances |
| `transaction` | finance | 1 | the journal's balanced entries |
| `invoice` | finance | 1 | issue, send, get paid |
| `client` | work | 1 | contacts and companies |
| `project` | work | 1 | initiatives, their milestones and budgets |
| `task` | work | 1 | assignable work |
| `timesheet` | work | 1 | time entries and members' months |
| `expense` | finance | 1 | capture, approve within a budget, reimburse |
| `payslip` | finance | 1 | salaries, monthly pay runs and payslips |
| `meeting` | governance | later | agendas, attendance, minutes |
| `agent` | platform | later | agents acting for members, with narrower grants |

Seedling's co-op economics that rung 1 still leaves out: a work share
divided by hours (an `account-timesheet` graft) or by revenue; paying in
subscribed capital, buyout over years, revolving capital and dues in
`account`; quotes with `project`.

Rung 1's pilot runs one write of each kind end to end: edit a document
(confluent), issue an invoice (bounded, numbered by the server until rung 2),
and admit a member by vote (ordered).

## Grafts

| Graft | What it joins |
|---|---|
| `account-decision` | a surplus allocation and the decision that approved it |
| `account-member` | who holds each capital account, the share's value, draw limits, and the freeze on exit |
| `account-member-transaction` | a member's subscription on admission and their draws, posted |
| `account-payslip` | a surplus's work share divided by salary |
| `account-transaction` | a transaction's lines post to accounts, never into a closed period; a surplus's split posted, the legal reserve's floor |
| `circle-expense-member` | a mandate's budget, spent by the expenses its holder approves |
| `circle-decision` | nesting circles and granting and revoking mandates by decision |
| `circle-decision-member` | a decision's roll, who was seated in its circle when it was proposed, whether it passes on it, and what a passing one does to members and seats |
| `circle-member` | positions: who holds which role in which circle, and how far a power reaches |
| `circle-member-project` | a lead runs their own circle's projects |
| `circle-member-timesheet` | a lead approves their own circle's time |
| `client-invoice` | who an invoice bills |
| `client-project` | whom a project is for |
| `decision-document` | adoption of a document version by a decision |
| `decision-member` | admission, suspension and exit by a decision |
| `expense-member` | whose an expense is |
| `expense-project` | the project an expense is billed on to |
| `expense-transaction` | an expense's approval and reimbursement post transactions |
| `invoice-project` | which project an invoice bills, and what each project invoiced |
| `invoice-transaction` | an invoice, its payments and its void post transactions |
| `key-member` | a member's devices, the first carried by their invitation and enrolled by their admission |
| `member-project` | shares of a project's budget, never beyond it |
| `member-task` | who does a task |
| `member-payslip` | whose a salary and a payslip are |
| `member-timesheet` | whose time an entry is, and a member's months |
| `payslip-timesheet` | a pay run from approved time |
| `payslip-transaction` | a pay run's approval and payment post transactions |
| `project-task` | which project and milestone a task is in |
| `project-timesheet` | time against a project, and what it spent of the budget |
