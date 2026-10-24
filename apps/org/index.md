+++
title = "Org"
updated = 2026-10-24
+++

The co-op ERP, for member-governed organisations. One deployment serves one
scope: a co-op, a joint circle of co-ops, or a federation.

- `core/` is what every feat inherits, one library each: `ops` (write labels,
  permissions, outcomes), `crypto`, `log` and `keystore`.
- `feats/` holds one domain each; none imports another.
- `grafts/` joins two feats, through their cores.
- `ts/` assembles the app: the SvelteKit shell, routes and the server.

## Feats

| Feat | Group | Rung | What |
|---|---|---|---|
| `key` | platform | 1 | members' devices and their keys |
| `member` | governance | 1 | a person's membership, invited to exited |
| `circle` | governance | 1 | nested units, positions, roles and mandates |
| `decision` | governance | 1 | proposals, votes, computed outcomes |
| `document` | governance | 1 | drafts, versions and adoption |
| `ledger` | finance | 1 | the double-entry books |
| `invoice` | finance | 1 | issue, send, get paid |
| `client` | work | 1 | contacts and companies |
| `meeting` | governance | later | agendas, attendance, minutes |
| `project` | work | later | initiatives, milestones, budgets and shares |
| `task` | work | later | assignable work |
| `timesheet` | work | later | time entries and their periods |
| `capital` | finance | later | capital accounts, reserves, funds, surplus allocation |
| `expense` | finance | later | capture, approve, reimburse |
| `payslip` | finance | later | pay periods and payslips |
| `agent` | platform | later | agents acting for members, with narrower grants |

Rung 1's pilot runs one write of each kind end to end: edit a document
(confluent), issue an invoice (bounded, numbered by the server until rung 2),
and admit a member by vote (ordered).

## Grafts

| Graft | What it joins |
|---|---|
| `circle-member` | positions: who holds which role in which circle |
| `client-invoice` | who an invoice bills |
| `decision-document` | adoption of a document version by a decision |
| `decision-member` | admission and suspension by a decision |
| `invoice-ledger` | an invoice and its payments post to the books |
