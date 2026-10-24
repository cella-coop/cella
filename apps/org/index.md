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
(governance); Clients (work); Invoices, Accounts, Periods and Transactions
(finance); Devices and the Log (platform). Every collection is the same
component, with a list and a table view, and every item the same detail
view, its drawer's cards filled by the feat and the grafts that join it.
Ctrl-K jumps to any collection or item.

What it writes, as the member picked in the user menu (dev only), each
showing its outcome, Settled with its log entry or Refused with the
rule's reason:

- a stance on an open decision, and closing it, which admits and seats the
  members a passing admission names;
- an edit of a document's draft from a plain text area, sent as one Loro
  update; saving a version; a comment. A live collaborative editor is not
  built;
- a new invoice, numbered by the server and posted to the books; a
  payment, posted; a void, its credit note posted; marking it sent;
  linking it to a client;
- a member's own name, a client's note, closing a month.

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
| `meeting` | governance | later | agendas, attendance, minutes |
| `project` | work | later | initiatives, milestones, budgets and shares |
| `task` | work | later | assignable work |
| `timesheet` | work | later | time entries and their periods |
| `expense` | finance | later | capture, approve, reimburse |
| `payslip` | finance | later | pay periods and payslips |
| `agent` | platform | later | agents acting for members, with narrower grants |

Seedling's co-op economics that rung 1 leaves out land with the later
feats: patronage inputs (hours, wages, revenue per member) with
`timesheet`, `payslip` and `invoice` through grafts onto `account`;
buy-in, buyout over years, revolving capital and dues in `account`, once an
`account-member` graft links capital accounts to members; quotes and
budgets with `project`.

Rung 1's pilot runs one write of each kind end to end: edit a document
(confluent), issue an invoice (bounded, numbered by the server until rung 2),
and admit a member by vote (ordered).

## Grafts

| Graft | What it joins |
|---|---|
| `account-decision` | a surplus allocation and the decision that approved it |
| `account-transaction` | a transaction's lines post to accounts, never into a closed period |
| `circle-decision-member` | a decision's roll, who was seated in its circle when it was proposed, and whether it passes on it |
| `circle-member` | positions: who holds which role in which circle |
| `client-invoice` | who an invoice bills |
| `decision-document` | adoption of a document version by a decision |
| `decision-member` | admission and suspension by a decision |
| `invoice-transaction` | an invoice, its payments and its void post transactions |
